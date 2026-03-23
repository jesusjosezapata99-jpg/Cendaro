/**
 * Cendaro — tRPC Context & Procedures
 *
 * Defines the tRPC context (DB + user), public/protected procedures,
 * and RBAC-aware procedure helpers.
 */
import type { User } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type {
  erpModuleEnum,
  permissionActionEnum,
  userRoleEnum,
  workspacePlanEnum,
} from "@cendaro/db/schema";
import { getDb } from "@cendaro/db/client";
import {
  Permission,
  RolePermission,
  Workspace,
  WorkspaceMember,
  WorkspaceModule,
} from "@cendaro/db/schema";

import type { ILogger } from "./logger";
import { generateRequestId, logger } from "./logger";

// ──────────────────────────────────────────────
// 1. CONTEXT
// ──────────────────────────────────────────────

export interface UserMeta {
  role: (typeof userRoleEnum.enumValues)[number];
}

/** Workspace-scoped membership context attached by workspaceProcedure */
export interface WorkspaceMembership {
  workspaceId: string;
  memberId: string;
  role: (typeof userRoleEnum.enumValues)[number];
  plan: (typeof workspacePlanEnum.enumValues)[number];
}

export const createTRPCContext = (opts: {
  headers: Headers;
  user: (User & { user_metadata?: UserMeta }) | null;
}) => {
  const requestId = opts.headers.get("x-request-id") ?? generateRequestId();
  const workspaceId = opts.headers.get("x-workspace-id") ?? null;

  // Create a request-scoped logger with user context
  const userRole = (opts.user?.user_metadata as UserMeta | undefined)?.role;
  const log: ILogger = logger.child({
    requestId,
    userId: opts.user?.id,
    userRole,
    workspaceId,
  });

  return {
    user: opts.user,
    db: getDb(),
    requestId,
    log,
    workspaceId,
  };
};

// ──────────────────────────────────────────────
// 2. INITIALIZATION
// ──────────────────────────────────────────────

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

// ──────────────────────────────────────────────
// 3. ROUTER & PROCEDURES
// ──────────────────────────────────────────────

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Structured request logging middleware.
 *
 * • Logs every procedure call with requestId, path, userId, duration
 * • In dev: pretty colored output (all requests)
 * • In prod: structured JSON (only slow > 500ms + errors)
 * • Automatically tags slow queries (> 200ms warning, > 1000ms error)
 */
const loggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();
  const reqLog = ctx.log.child({ path, method: type });

  reqLog.debug(`→ ${path}`);

  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);

    if (durationMs > 1000) {
      reqLog.warn(`⚠ SLOW ${path}`, { durationMs });
    } else if (durationMs > 200) {
      reqLog.info(`✓ ${path}`, { durationMs });
    } else {
      reqLog.debug(`✓ ${path}`, { durationMs });
    }

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);

    if (err instanceof TRPCError) {
      // Expected errors (UNAUTHORIZED, FORBIDDEN, etc.) at warn level
      const isClientError = [
        "UNAUTHORIZED",
        "FORBIDDEN",
        "BAD_REQUEST",
        "NOT_FOUND",
      ].includes(err.code);
      if (isClientError) {
        reqLog.warn(
          `✗ ${path} [${err.code}]`,
          { durationMs, trpcCode: err.code },
          err,
        );
      } else {
        reqLog.error(
          `✗ ${path} [${err.code}]`,
          { durationMs, trpcCode: err.code },
          err,
        );
      }
    } else {
      reqLog.error(`✗ ${path} [INTERNAL]`, { durationMs }, err);
    }

    throw err;
  }
});

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

/**
 * Protected (authenticated) procedure — requires valid session
 */
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        user: ctx.user,
      },
    });
  });

/**
 * Role-restricted procedure factory — requires specific roles
 * Usage: roleRestrictedProcedure(["admin", "owner"]).query(...)
 */
export function roleRestrictedProcedure(
  allowedRoles: (typeof userRoleEnum.enumValues)[number][],
) {
  return protectedProcedure.use(({ ctx, next }) => {
    const userRole = (ctx.user.user_metadata as UserMeta | undefined)?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Se requiere uno de los roles: ${allowedRoles.join(", ")}`,
      });
    }
    return next({ ctx });
  });
}

/**
 * Permission-restricted procedure factory — queries the permission + role_permission tables
 * Usage: permissionProcedure("catalog", "create").mutation(...)
 *
 * This enforces fine-grained, database-driven authorization:
 * 1. Checks the user has a valid role
 * 2. Queries role_permission + permission tables for module/action match
 * 3. Allows dynamic permission changes without re-deploy
 */
export function permissionProcedure(
  module: (typeof erpModuleEnum.enumValues)[number],
  action: (typeof permissionActionEnum.enumValues)[number],
) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const userRole = (ctx.user.user_metadata as UserMeta | undefined)?.role;
    if (!userRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No se pudo determinar el rol del usuario",
      });
    }

    // Owner bypasses permission checks
    if (userRole === "owner") {
      return next({ ctx });
    }

    const result = await ctx.db
      .select({ id: Permission.id })
      .from(RolePermission)
      .innerJoin(Permission, eq(RolePermission.permissionId, Permission.id))
      .where(
        and(
          eq(RolePermission.role, userRole),
          eq(Permission.module, module),
          eq(Permission.action, action),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permiso denegado: ${module}.${action} no asignado al rol ${userRole}`,
      });
    }

    return next({ ctx });
  });
}

// ──────────────────────────────────────────────
// 5. WORKSPACE-SCOPED PROCEDURES (Multi-Tenancy)
// ──────────────────────────────────────────────

/**
 * Workspace procedure — the primary multi-tenancy barrier.
 *
 * 1. Requires `x-workspace-id` header
 * 2. Validates active membership via `is_workspace_member()` SQL function
 * 3. Wraps in transaction with `SET LOCAL ROLE app_user` + RLS
 * 4. Attaches workspace context (role, plan, memberId)
 */
export const workspaceProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "x-workspace-id header is required",
      });
    }

    // Validate membership (runs as postgres, before SET LOCAL)
    const memberRows = await ctx.db.execute<{
      member_id: string;
      member_role: string;
      member_status: string;
    }>(
      sql`SELECT * FROM is_workspace_member(${ctx.user.id}::uuid, ${ctx.workspaceId}::uuid)`,
    );

    const member = memberRows[0];
    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No eres miembro activo de este workspace",
      });
    }

    // Get workspace plan
    const [ws] = await ctx.db
      .select({ plan: Workspace.plan })
      .from(Workspace)
      .where(eq(Workspace.id, ctx.workspaceId))
      .limit(1);

    const workspace: WorkspaceMembership = {
      workspaceId: ctx.workspaceId,
      memberId: member.member_id,
      role: member.member_role as WorkspaceMembership["role"],
      plan: ws?.plan ?? "starter",
    };

    // Execute inside transaction with SET LOCAL for RLS enforcement
    return ctx.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_user`);
      await tx.execute(sql`SET LOCAL app.workspace_id = ${ctx.workspaceId}`);
      return next({
        ctx: {
          ...ctx,
          db: tx as unknown as typeof ctx.db,
          workspace,
        },
      });
    });
  },
);

/**
 * Module procedure — gates access by workspace-enabled modules.
 * Usage: moduleProcedure("catalog").query(...)
 */
export function moduleProcedure(
  module: (typeof erpModuleEnum.enumValues)[number],
) {
  return workspaceProcedure.use(async ({ ctx, next }) => {
    const [enabled] = await ctx.db
      .select({ id: WorkspaceModule.id })
      .from(WorkspaceModule)
      .where(
        and(
          eq(WorkspaceModule.workspaceId, ctx.workspace.workspaceId),
          eq(WorkspaceModule.module, module),
        ),
      )
      .limit(1);

    if (!enabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Módulo "${module}" no habilitado en este workspace`,
      });
    }
    return next({ ctx });
  });
}

/**
 * Workspace permission procedure — module + RBAC permission check.
 * Usage: wsPermissionProcedure("catalog", "create").mutation(...)
 */
export function wsPermissionProcedure(
  module: (typeof erpModuleEnum.enumValues)[number],
  action: (typeof permissionActionEnum.enumValues)[number],
) {
  return moduleProcedure(module).use(async ({ ctx, next }) => {
    // Owner bypasses permission checks
    if (ctx.workspace.role === "owner") {
      return next({ ctx });
    }

    const [perm] = await ctx.db
      .select({ id: Permission.id })
      .from(RolePermission)
      .innerJoin(Permission, eq(RolePermission.permissionId, Permission.id))
      .where(
        and(
          eq(
            RolePermission.role,
            ctx.workspace.role as (typeof userRoleEnum.enumValues)[number],
          ),
          eq(Permission.module, module),
          eq(Permission.action, action),
        ),
      )
      .limit(1);

    if (!perm) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permiso denegado: ${module}.${action}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Organization admin procedure — cross-workspace access for owners.
 * Runs as `postgres` (no SET LOCAL) so queries see all workspaces.
 */
export const orgAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const [membership] = await ctx.db
      .select({ role: WorkspaceMember.role })
      .from(WorkspaceMember)
      .where(
        and(
          eq(WorkspaceMember.userId, ctx.user.id),
          eq(WorkspaceMember.role, "owner"),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Se requiere rol de dueño de organización",
      });
    }

    return next({ ctx });
  },
);
