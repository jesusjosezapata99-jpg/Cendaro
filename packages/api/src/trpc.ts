/**
 * Cendaro — tRPC Context & Procedures
 *
 * Defines the tRPC context (DB + user), public/protected procedures,
 * and RBAC-aware procedure helpers.
 */
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
// 1a. PERMISSION & MODULE CACHE
// ──────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const permissionCache = new Map<string, CacheEntry<boolean>>();
const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PERMISSION_CACHE_MAX = 1000;

function getPermissionCacheKey(
  type: "permission" | "module" | "ws_permission",
  ...parts: string[]
): string {
  return `${type}:${parts.join(":")}`;
}

function getCachedPermission(key: string): boolean | undefined {
  const entry = permissionCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    permissionCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedPermission(key: string, value: boolean): void {
  // Evict oldest entries when cache is full
  if (permissionCache.size >= PERMISSION_CACHE_MAX) {
    const oldest = permissionCache.keys().next().value;
    if (oldest) permissionCache.delete(oldest);
  }
  permissionCache.set(key, {
    value,
    expiry: Date.now() + PERMISSION_CACHE_TTL,
  });
}

export function invalidatePermissionCache(): void {
  permissionCache.clear();
  membershipCache.clear();
}

// ──────────────────────────────────────────────
// 1b. PER-REQUEST MEMBERSHIP CACHE
// Caches is_workspace_member() + workspace plan lookups so that
// multiple workspaceProcedure calls in the same batch share the result.
// ──────────────────────────────────────────────

const membershipCache = new Map<
  string,
  CacheEntry<{
    memberId: string;
    role: WorkspaceMembership["role"];
    plan: WorkspaceMembership["plan"];
  }>
>();
const MEMBERSHIP_CACHE_TTL = 60 * 1000; // 1 minute
const MEMBERSHIP_CACHE_MAX = 500;

function getMembershipKey(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}`;
}

// ──────────────────────────────────────────────
// 1. CONTEXT
// ──────────────────────────────────────────────

export interface UserMeta {
  role: (typeof userRoleEnum.enumValues)[number];
}

/**
 * Minimal authenticated-identity shape — the only fields the API layer
 * consumes (RBAC reads user_metadata.role; audit reads id/email).
 * Populated from locally-verified JWT claims (supabase.auth.getClaims)
 * instead of a full getUser() network round-trip per request.
 *
 * Trade-off (accepted): user_metadata changes propagate on token refresh
 * (~1h) instead of immediately; workspace-level RBAC still resolves fresh
 * from the DB via is_workspace_member().
 */
export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  user_metadata?: UserMeta;
}

/**
 * Maps verified access-token claims to AuthenticatedUser.
 * Returns null when the token carries no subject (unauthenticated).
 */
export function mapClaimsToUser(
  claims: Record<string, unknown> | null | undefined,
): AuthenticatedUser | null {
  if (!claims) return null;
  const sub = typeof claims.sub === "string" ? claims.sub : undefined;
  if (!sub) return null;
  const meta = claims.user_metadata;
  return {
    id: sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata:
      meta && typeof meta === "object" ? (meta as UserMeta) : undefined,
  };
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
  user: AuthenticatedUser | null;
}) => {
  const requestId = opts.headers.get("x-request-id") ?? generateRequestId();
  const workspaceId = opts.headers.get("x-workspace-id") ?? null;

  // Create a request-scoped logger with user context
  const userRole = opts.user?.user_metadata?.role;
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
 *
 * IMPORTANT: tRPC's `next()` never rejects — every level of the middleware
 * chain (see `callRecursive` in @trpc/server) catches the downstream error
 * internally and resolves `next()` with `{ ok: false, error }` instead of
 * throwing. A `try/catch` around `await next()` here would therefore never
 * catch anything, silently logging every failed procedure as a success
 * (fixed 2026-09 — see Cendaro UI-REPORT-2026-09-PREMIUM-IDENTITY §5, C2).
 * We must branch on `result.ok` instead.
 */
const loggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();
  const reqLog = ctx.log.child({ path, method: type });

  reqLog.debug(`→ ${path}`);

  const result = await next();
  const durationMs = Math.round(performance.now() - start);

  if (!result.ok) {
    const err = result.error;
    const isClientError = (
      [
        "UNAUTHORIZED",
        "FORBIDDEN",
        "BAD_REQUEST",
        "NOT_FOUND",
      ] as TRPCError["code"][]
    ).includes(err.code);

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

    return result;
  }

  if (durationMs > 1000) {
    reqLog.warn(`⚠ SLOW ${path}`, { durationMs });
  } else if (durationMs > 200) {
    reqLog.info(`✓ ${path}`, { durationMs });
  } else {
    reqLog.debug(`✓ ${path}`, { durationMs });
  }

  return result;
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
    const userRole = ctx.user.user_metadata?.role;
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
    const userRole = ctx.user.user_metadata?.role;
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

    const cacheKey = getPermissionCacheKey(
      "permission",
      ctx.user.id,
      module,
      action,
    );
    const cached = getCachedPermission(cacheKey);
    if (cached !== undefined) {
      if (!cached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Permiso denegado: ${module}.${action} no asignado al rol ${userRole}`,
        });
      }
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
      setCachedPermission(cacheKey, false);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permiso denegado: ${module}.${action} no asignado al rol ${userRole}`,
      });
    }

    setCachedPermission(cacheKey, true);
    return next({ ctx });
  });
}

// ──────────────────────────────────────────────
// 1c. MEMBERSHIP RESOLUTION HELPER
// Shared between workspaceProcedure (writes) and workspaceReadProcedure (reads)
// ──────────────────────────────────────────────

interface MembershipResolution {
  workspaceId: string;
  memberId: string;
  memberRole: WorkspaceMembership["role"];
  workspacePlan: WorkspaceMembership["plan"];
}

type ProtectedContext = Awaited<ReturnType<typeof createTRPCContext>> & {
  user: NonNullable<Awaited<ReturnType<typeof createTRPCContext>>["user"]>;
};

/**
 * Resolves workspace membership for the current user.
 * Uses in-memory cache to deduplicate lookups across batch calls.
 * Throws FORBIDDEN if user is not an active workspace member.
 */
async function resolveWorkspaceMembership(
  ctx: ProtectedContext,
): Promise<MembershipResolution> {
  if (!ctx.workspaceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "x-workspace-id header is required",
    });
  }

  const cacheKey = getMembershipKey(ctx.user.id, ctx.workspaceId);
  const cachedEntry = membershipCache.get(cacheKey);
  const now = Date.now();

  // Clean up expired entry on read
  if (cachedEntry && cachedEntry.expiry <= now) {
    membershipCache.delete(cacheKey);
  }
  const freshEntry =
    cachedEntry && cachedEntry.expiry > now ? cachedEntry : undefined;

  if (freshEntry) {
    return {
      workspaceId: ctx.workspaceId,
      memberId: freshEntry.value.memberId,
      memberRole: freshEntry.value.role,
      workspacePlan: freshEntry.value.plan,
    };
  }

  // Validate membership (runs as postgres, before SET LOCAL) and fetch the
  // workspace plan — independent lookups, so they run in parallel instead
  // of paying two sequential round-trips on cache misses.
  const [memberRows, wsRows] = await Promise.all([
    ctx.db.execute<{
      member_id: string;
      member_role: string;
      member_status: string;
    }>(
      sql`SELECT * FROM is_workspace_member(${ctx.user.id}::uuid, ${ctx.workspaceId}::uuid)`,
    ),
    ctx.db
      .select({ plan: Workspace.plan })
      .from(Workspace)
      .where(eq(Workspace.id, ctx.workspaceId))
      .limit(1),
  ]);

  const member = memberRows[0];
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No eres miembro activo de este workspace",
    });
  }

  const memberId = member.member_id;
  const memberRole = member.member_role as WorkspaceMembership["role"];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const workspacePlan = (wsRows[0]?.plan ??
    "starter") as WorkspaceMembership["plan"];

  // Cache for subsequent calls in this request batch
  if (membershipCache.size >= MEMBERSHIP_CACHE_MAX) {
    const oldest = membershipCache.keys().next().value;
    if (oldest) membershipCache.delete(oldest);
  }
  membershipCache.set(cacheKey, {
    value: { memberId, role: memberRole, plan: workspacePlan },
    expiry: now + MEMBERSHIP_CACHE_TTL,
  });

  return { workspaceId: ctx.workspaceId, memberId, memberRole, workspacePlan };
}

// ──────────────────────────────────────────────
// 5. WORKSPACE-SCOPED PROCEDURES (Multi-Tenancy)
// ──────────────────────────────────────────────

/**
 * Workspace procedure — the primary multi-tenancy barrier for WRITE operations.
 *
 * 1. Requires `x-workspace-id` header
 * 2. Validates active membership via `is_workspace_member()` SQL function
 * 3. Wraps in transaction with `SET LOCAL ROLE app_user` + RLS
 * 4. Attaches workspace context (role, plan, memberId)
 *
 * Use this for mutations (INSERT/UPDATE/DELETE) that need RLS enforcement.
 */
export const workspaceProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const resolved = await resolveWorkspaceMembership(ctx);

    const workspace: WorkspaceMembership = {
      workspaceId: resolved.workspaceId,
      memberId: resolved.memberId,
      role: resolved.memberRole,
      plan: resolved.workspacePlan,
    };

    // Execute inside transaction with SET LOCAL for RLS enforcement
    return ctx.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_user`);
      // `SET LOCAL app.workspace_id = $1` cannot be parameterized — Postgres's
      // SET command does not accept bind parameters in the value position over
      // the extended query protocol (which postgres.js uses when `prepare`
      // is enabled, the default on the session-mode pooler). set_config() is a
      // regular function call and fully supports parameters; its third
      // argument (`true` = is_local) makes it behave exactly like SET LOCAL,
      // scoped to this transaction only. Confirmed 2026-09 (Cendaro C1
      // follow-up): this surfaced only after the app_user role GRANT was
      // fixed, previously masked by the earlier "permission denied to set
      // role" failure on the line above.
      await tx.execute(
        sql`SELECT set_config('app.workspace_id', ${resolved.workspaceId}, true)`,
      );
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
 * Workspace read procedure — for READ-only queries without transaction overhead.
 *
 * Skips the BEGIN/COMMIT + SET LOCAL dance that workspaceProcedure uses.
 * Membership is still validated and cached, but queries run directly against
 * the pool connection. This eliminates 4 extra DB round-trips per query.
 *
 * SAFE for reads because:
 * 1. Membership validation confirms user belongs to workspace
 * 2. Queries already include workspace_id filtering in WHERE clauses
 * 3. RLS via SET LOCAL is only needed for writes where policy enforcement matters
 *
 * Use this for all .query() procedures. Keep workspaceProcedure for .mutation().
 */
export const workspaceReadProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const resolved = await resolveWorkspaceMembership(ctx);

    const workspace: WorkspaceMembership = {
      workspaceId: resolved.workspaceId,
      memberId: resolved.memberId,
      role: resolved.memberRole,
      plan: resolved.workspacePlan,
    };

    // NO transaction, NO SET LOCAL — reads don't need RLS enforcement
    return next({
      ctx: {
        ...ctx,
        workspace,
      },
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
    const cacheKey = getPermissionCacheKey(
      "module",
      ctx.user.id,
      ctx.workspace.workspaceId,
      module,
    );
    const cached = getCachedPermission(cacheKey);
    if (cached !== undefined) {
      if (!cached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Módulo "${module}" no habilitado en este workspace`,
        });
      }
      return next({ ctx });
    }

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
      setCachedPermission(cacheKey, false);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Módulo "${module}" no habilitado en este workspace`,
      });
    }
    setCachedPermission(cacheKey, true);
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

    const cacheKey = getPermissionCacheKey(
      "ws_permission",
      ctx.user.id,
      ctx.workspace.workspaceId,
      module,
      action,
    );
    const cached = getCachedPermission(cacheKey);
    if (cached !== undefined) {
      if (!cached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Permiso denegado: ${module}.${action}`,
        });
      }
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
      setCachedPermission(cacheKey, false);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permiso denegado: ${module}.${action}`,
      });
    }

    setCachedPermission(cacheKey, true);
    return next({ ctx });
  });
}

/**
 * Module read procedure — workspace-enabled module gate for reads (no transaction).
 * Usage: moduleReadProcedure("catalog").query(...)
 */
export function moduleReadProcedure(
  module: (typeof erpModuleEnum.enumValues)[number],
) {
  return workspaceReadProcedure.use(async ({ ctx, next }) => {
    const cacheKey = getPermissionCacheKey(
      "module",
      ctx.user.id,
      ctx.workspace.workspaceId,
      module,
    );
    const cached = getCachedPermission(cacheKey);
    if (cached !== undefined) {
      if (!cached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Módulo "${module}" no habilitado en este workspace`,
        });
      }
      return next({ ctx });
    }

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
      setCachedPermission(cacheKey, false);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Módulo "${module}" no habilitado en este workspace`,
      });
    }
    setCachedPermission(cacheKey, true);
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
