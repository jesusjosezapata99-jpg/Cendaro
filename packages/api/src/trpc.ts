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

import type { userRoleEnum, workspacePlanEnum } from "@cendaro/db/schema";
import type { ErpModule, PermissionAction } from "@cendaro/validators";
import { getDb } from "@cendaro/db/client";
import { UserProfile, Workspace, WorkspaceModule } from "@cendaro/db/schema";
import { can, isCoreModule } from "@cendaro/validators";

import type { ILogger } from "./logger";
import { generateRequestId, logger } from "./logger";

// ──────────────────────────────────────────────
// 1a. PLAN MODULE CACHE (process-wide, 5 min TTL)
// Caches "is module X enabled for workspace Y" (workspace_module). Role
// permissions are never cached: they come from the static matrix.
// ──────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const moduleCache = new Map<string, CacheEntry<boolean>>();
const MODULE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MODULE_CACHE_MAX = 1000;

function getCachedModule(key: string): boolean | undefined {
  const entry = moduleCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    moduleCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedModule(key: string, value: boolean): void {
  // Evict oldest entries when cache is full
  if (moduleCache.size >= MODULE_CACHE_MAX) {
    const oldest = moduleCache.keys().next().value;
    if (oldest) moduleCache.delete(oldest);
  }
  moduleCache.set(key, {
    value,
    expiry: Date.now() + MODULE_CACHE_TTL,
  });
}

/**
 * Drops every cached membership entry for one user on this server instance.
 * Call after changing a user's workspace role or status so the change takes
 * effect immediately here; other instances converge within
 * MEMBERSHIP_CACHE_TTL (cross-instance revocation is PLAN-2026-09-SECURITY-
 * REMEDIATION F5). Role permissions themselves are not cached: they are
 * evaluated from the static matrix in @cendaro/validators on every call.
 */
export function invalidateUserAuthzCache(userId: string): void {
  for (const key of membershipCache.keys()) {
    if (key.startsWith(`${userId}:`)) membershipCache.delete(key);
  }
}

// ──────────────────────────────────────────────
// 1b. MEMBERSHIP CACHE (process-wide, 60s TTL)
// Caches is_workspace_member() + workspace plan + display name so that a
// tRPC batch and quick follow-up requests share one lookup. It is NOT scoped
// to a request: a revoked role can stay valid for up to MEMBERSHIP_CACHE_TTL
// on instances that did not process the change (see invalidateUserAuthzCache).
// ──────────────────────────────────────────────

const membershipCache = new Map<
  string,
  CacheEntry<{
    memberId: string;
    role: WorkspaceMembership["role"];
    plan: WorkspaceMembership["plan"];
    displayName: string | null;
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

export type UserRole = (typeof userRoleEnum.enumValues)[number];

/** Supabase authenticator assurance level (`aal2` = MFA verified this session). */
export type AuthAssuranceLevel = "aal1" | "aal2";

/**
 * Authenticated identity from locally-verified JWT claims
 * (supabase.auth.getClaims). Deliberately carries NO role: `user_metadata`
 * is writable by the user through `auth.updateUser()`, so any role read from
 * it is attacker-controlled. Roles come only from `workspace_member` via
 * `is_workspace_member()` (see WorkspaceActor). Guarded by
 * `__tests__/metadata-role-escalation.test.ts`.
 */
export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  aal?: AuthAssuranceLevel | null;
}

/** AuthenticatedUser enriched with DB-verified workspace facts. */
export interface WorkspaceActor extends AuthenticatedUser {
  workspaceRole: UserRole;
  displayName: string | null;
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
  return {
    id: sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal1" || claims.aal === "aal2" ? claims.aal : null,
  };
}

/** Workspace-scoped membership context attached by workspaceProcedure */
export interface WorkspaceMembership {
  workspaceId: string;
  memberId: string;
  role: (typeof userRoleEnum.enumValues)[number];
  plan: (typeof workspacePlanEnum.enumValues)[number];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate that a value is a standard RFC 4122 UUID */
export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val);
}

export const createTRPCContext = (opts: {
  headers: Headers;
  user: AuthenticatedUser | null;
}) => {
  const requestId = opts.headers.get("x-request-id") ?? generateRequestId();
  const rawWorkspaceId = opts.headers.get("x-workspace-id");
  const workspaceId =
    rawWorkspaceId && isValidUuid(rawWorkspaceId) ? rawWorkspaceId : null;

  const log: ILogger = logger.child({
    requestId,
    userId: opts.user?.id,
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

/**
 * Authorization decision recorded on every exposed procedure.
 *   permission — role must hold module.action and the module must be enabled
 *   member     — any active workspace member
 *   self       — authenticated caller, own data only, no workspace
 *   public     — no authentication (health checks)
 */
export type ProcedureAuthz =
  | { kind: "permission"; module: ErpModule; action: PermissionAction }
  | { kind: "member" }
  | { kind: "self" }
  | { kind: "public" };

export interface ProcedureMeta {
  authz?: ProcedureAuthz;
}

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => {
      const isProduction = process.env.NODE_ENV === "production";
      const isInternalError = shape.data.code === "INTERNAL_SERVER_ERROR";
      return {
        ...shape,
        message:
          isProduction && isInternalError
            ? "Error interno del servidor"
            : shape.message,
        data: {
          ...shape.data,
          stack: isProduction ? undefined : shape.data.stack,
          zodError:
            error.cause instanceof ZodError
              ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
              : null,
        },
      };
    },
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

// ──────────────────────────────────────────────
// 1c. MEMBERSHIP RESOLUTION HELPER
// Shared between workspaceProcedure (writes) and workspaceReadProcedure (reads)
// ──────────────────────────────────────────────

interface MembershipResolution {
  workspaceId: string;
  memberId: string;
  memberRole: WorkspaceMembership["role"];
  workspacePlan: WorkspaceMembership["plan"];
  displayName: string | null;
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

  if (!isValidUuid(ctx.workspaceId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "x-workspace-id header must be a valid UUID",
    });
  }

  if (!isValidUuid(ctx.user.id)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User ID must be a valid UUID",
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
      displayName: freshEntry.value.displayName,
    };
  }

  // Validate membership (runs as postgres, before SET LOCAL) and fetch the
  // workspace plan and the actor's display name — independent lookups, so
  // they run in parallel instead of paying sequential round-trips on cache
  // misses. The display name comes from user_profile (never user_metadata,
  // which the user can edit) so audit entries cannot be spoofed.
  const [memberResult, wsRows, profileRows] = await Promise.all([
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
    ctx.db
      .select({ fullName: UserProfile.fullName })
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1),
  ]);

  const member = memberResult.rows[0];
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
  const displayName = profileRows[0]?.fullName ?? null;

  // Cache for subsequent calls in this request batch
  if (membershipCache.size >= MEMBERSHIP_CACHE_MAX) {
    const oldest = membershipCache.keys().next().value;
    if (oldest) membershipCache.delete(oldest);
  }
  membershipCache.set(cacheKey, {
    value: { memberId, role: memberRole, plan: workspacePlan, displayName },
    expiry: now + MEMBERSHIP_CACHE_TTL,
  });

  return {
    workspaceId: ctx.workspaceId,
    memberId,
    memberRole,
    workspacePlan,
    displayName,
  };
}

function toWorkspaceActor(
  user: AuthenticatedUser,
  resolved: MembershipResolution,
): WorkspaceActor {
  return {
    ...user,
    workspaceRole: resolved.memberRole,
    displayName: resolved.displayName,
  };
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
          user: toWorkspaceActor(ctx.user, resolved),
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
        user: toWorkspaceActor(ctx.user, resolved),
        workspace,
      },
    });
  },
);

// ──────────────────────────────────────────────
// 6. AUTHORIZATION-DECLARING PROCEDURES (PLAN-2026-09-SECURITY-REMEDIATION F2)
//
// Every procedure exposed by appRouter must be built from one of the builders
// below, which record `meta.authz`. `__tests__/procedure-authz-coverage.test.ts`
// fails the build for any procedure without it, so a new endpoint cannot ship
// without an explicit authorization decision.
// ──────────────────────────────────────────────

interface EnabledModuleContext {
  db: ReturnType<typeof getDb>;
  workspace: WorkspaceMembership;
}

/**
 * Throws FORBIDDEN unless `module` is enabled for the workspace's plan.
 * Core modules (dashboard, users, settings, audit) are always enabled.
 */
async function assertModuleEnabled(
  ctx: EnabledModuleContext,
  module: ErpModule,
): Promise<void> {
  if (isCoreModule(module)) return;

  const cacheKey = `module:${ctx.workspace.workspaceId}:${module}`;
  let enabled = getCachedModule(cacheKey);

  if (enabled === undefined) {
    const [row] = await ctx.db
      .select({ id: WorkspaceModule.id })
      .from(WorkspaceModule)
      .where(
        and(
          eq(WorkspaceModule.workspaceId, ctx.workspace.workspaceId),
          eq(WorkspaceModule.module, module),
        ),
      )
      .limit(1);
    enabled = !!row;
    setCachedModule(cacheKey, enabled);
  }

  if (!enabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Módulo "${module}" no habilitado en este workspace`,
    });
  }
}

/** Throws FORBIDDEN unless the DB workspace role holds module.action. */
function assertPermission(
  role: UserRole,
  module: ErpModule,
  action: PermissionAction,
): void {
  if (!can(role, module, action)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permiso denegado: ${module}.${action}`,
    });
  }
}

/**
 * Mutation (or transactional read) gated by role permission + plan module.
 * Runs inside workspaceProcedure's RLS transaction.
 * Usage: wsPermissionProcedure("catalog", "create").mutation(...)
 */
export function wsPermissionProcedure(
  module: ErpModule,
  action: PermissionAction,
) {
  return workspaceProcedure
    .meta({ authz: { kind: "permission", module, action } })
    .use(async ({ ctx, next }) => {
      assertPermission(ctx.workspace.role, module, action);
      await assertModuleEnabled(ctx, module);
      return next({ ctx });
    });
}

/**
 * Read gated by role permission + plan module (no transaction).
 * Usage: wsReadPermissionProcedure("catalog", "read").query(...)
 */
export function wsReadPermissionProcedure(
  module: ErpModule,
  action: PermissionAction,
) {
  return workspaceReadProcedure
    .meta({ authz: { kind: "permission", module, action } })
    .use(async ({ ctx, next }) => {
      assertPermission(ctx.workspace.role, module, action);
      await assertModuleEnabled(ctx, module);
      return next({ ctx });
    });
}

/**
 * Read available to every active member of the workspace, regardless of role
 * or plan (e.g. exchange rates shown on every page, the current workspace).
 */
export const memberReadProcedure = workspaceReadProcedure.meta({
  authz: { kind: "member" },
});

/** Authenticated caller acting only on their own data (no workspace). */
export const selfProcedure = protectedProcedure.meta({
  authz: { kind: "self" },
});

/** Unauthenticated endpoint (health checks only). */
export const publicHealthProcedure = publicProcedure.meta({
  authz: { kind: "public" },
});
