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
import type { AuthAssuranceLevel } from "./services/mfa-enforcement";
import { generateRequestId, logger } from "./logger";
import { mfaComplianceFor } from "./services/mfa-enforcement";
import { touchSessionActivity } from "./services/session-activity";

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

// ──────────────────────────────────────────────
// 1b. MEMBERSHIP CACHE (per request)
// is_workspace_member() + workspace plan + display name are resolved once per
// request and shared by every procedure of a tRPC batch. The map lives in the
// context, so it dies with the request: a suspended member is locked out on
// their very next request, on every instance, with no TTL to wait out.
// ──────────────────────────────────────────────

/** Exported because it appears in the inferred type of every router. */
export interface CachedMembership {
  memberId: string;
  role: WorkspaceMembership["role"];
  plan: WorkspaceMembership["plan"];
  displayName: string | null;
}

function getMembershipKey(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}`;
}

// ──────────────────────────────────────────────
// 1. CONTEXT
// ──────────────────────────────────────────────

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type { AuthAssuranceLevel } from "./services/mfa-enforcement";

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
  /**
   * The JWT's `session_id` claim (required on every Supabase access token).
   * Used to key `user_session_activity` for the idle-timeout check (F7.1) —
   * never for authorization, which stays on `id` via `workspace_member`.
   */
  sessionId?: string | null;
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
    sessionId: typeof claims.session_id === "string" ? claims.session_id : null,
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
    /** Membership resolved once per request (F5.3), never across requests. */
    membershipCache: new Map<string, CachedMembership>(),
    /**
     * Work that must run after the workspace RLS transaction commits, as
     * `postgres` rather than `app_user`: today, revoking the sessions of a
     * member who just lost access (F5.2). Queued callbacks run in order once
     * the mutation succeeds, and never run when it rolls back.
     */
    afterCommit: [] as ((db: ReturnType<typeof getDb>) => Promise<unknown>)[],
    /**
     * Set once `protectedProcedure` has verified session activity (F7.1) for
     * this request, so a tRPC batch of several procedures checks it once —
     * the context object is created once per HTTP request and shared by
     * every procedure in the batch, exactly like membershipCache above.
     */
    sessionActivityChecked: false,
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

/**
 * Thrown when an owner/admin session lacks a verified second factor past the
 * MFA grace period (F7.2). A distinct subclass — rather than a plain
 * `TRPCError({ code: "FORBIDDEN" })` — lets the error formatter below flag it
 * in `error.data.mfaRequired`, the same way `zodError` is already surfaced,
 * so the client can redirect straight to `/settings/security` instead of
 * pattern-matching the Spanish message text.
 */
export class MfaRequiredError extends TRPCError {
  constructor() {
    super({
      code: "FORBIDDEN",
      message:
        "Tu rol requiere autenticación de dos factores (TOTP). Actívala en Configuración → Seguridad.",
    });
  }
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
          mfaRequired: error instanceof MfaRequiredError,
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
  .use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Server-verified idle timeout (F7.1), covering /api/trpc directly —
    // unlike the proxy.ts cookie, which only ever sees page navigations.
    if (!ctx.sessionActivityChecked) {
      if (ctx.user.sessionId) {
        await touchSessionActivity(
          ctx.db,
          ctx.user.sessionId,
          ctx.user.id,
          Date.now(),
          { log: ctx.log },
        );
      } else {
        // Every Supabase access token carries session_id; its absence means
        // claims were mapped from something other than a real Supabase JWT
        // (e.g. a test double). Logged, not thrown: this is a soft control.
        ctx.log.warn("authenticated request has no session_id claim");
      }
      ctx.sessionActivityChecked = true;
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
  const cached = ctx.membershipCache.get(cacheKey);

  if (cached) {
    return {
      workspaceId: ctx.workspaceId,
      memberId: cached.memberId,
      memberRole: cached.role,
      workspacePlan: cached.plan,
      displayName: cached.displayName,
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

  // Shared by the rest of this request only (see the note above the map).
  ctx.membershipCache.set(cacheKey, {
    memberId,
    role: memberRole,
    plan: workspacePlan,
    displayName,
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

/**
 * Blocks a mutation from an owner/admin session without a verified second
 * factor, once the grace period (mfa-enforcement.ts) has ended.
 *
 * Deliberately applied to `workspaceProcedure` (mutations) only, not
 * `workspaceReadProcedure`: blocking reads too would also break the app
 * shell itself (workspace.current, users.me — loaded on every page,
 * including /settings/security) for the very account that needs to reach the
 * enrollment screen to fix it. The risk MFA mitigates — a compromised
 * privileged credential pushing through an approval, a role change, a
 * repricing — is a write, so that is where the gate belongs.
 */
function assertMfaCompliance(actor: WorkspaceActor): void {
  if (mfaComplianceFor(actor.workspaceRole, actor.aal).blocked) {
    throw new MfaRequiredError();
  }
}

/**
 * Runs `fn` in a transaction as `app_user` with `app.workspace_id` set, so
 * RLS policies apply — the isolation workspaceProcedure gives every
 * mutation. Also used directly by handlers that must finish slow external
 * I/O first (rate sync, scheduled jobs) so a pooled connection is not held
 * open while a third party answers.
 */
export function runInWorkspaceRls<T>(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  fn: (tx: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await bindWorkspaceRls(tx, workspaceId);
    return fn(tx as unknown as ReturnType<typeof getDb>);
  });
}

/**
 * Switches the open transaction to `app_user` and binds `app.workspace_id`,
 * in ONE statement (one network round trip instead of two).
 *
 * Both settings go through `set_config(..., true)`: the third argument makes
 * it transaction-local, exactly like `SET LOCAL`, and — unlike `SET LOCAL
 * app.workspace_id = ...` — it accepts bind parameters, which the extended
 * query protocol needs (confirmed 2026-09, Cendaro C1 follow-up). Setting the
 * `role` GUC is what `SET ROLE` itself does, so the privilege boundary is the
 * same: the role must be one the connecting user may assume, RLS then applies,
 * and `RESET ROLE`/commit restores the original. Verified on production
 * 2026-09-21: `current_user` becomes `app_user`, workspace policies apply,
 * infrastructure tables stay denied.
 *
 * Measured against the pooler (23 ms per round trip): the previous two-statement
 * form cost 121 ms per read, this form 93 ms.
 */
async function bindWorkspaceRls(
  tx: Pick<ReturnType<typeof getDb>, "execute">,
  workspaceId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT set_config('role', 'app_user', true), set_config('app.workspace_id', ${workspaceId}, true)`,
  );
}

/**
 * Read-only twin of `runInWorkspaceRls` (F9.2, finding M9).
 *
 * Until now `workspaceReadProcedure` ran every SELECT as `postgres`
 * (BYPASSRLS), so multi-tenant isolation depended 100% on each query
 * remembering its `workspace_id` filter — one forgotten WHERE away from a
 * cross-tenant leak. This wraps reads in a `READ ONLY` transaction under
 * `app_user` with `app.workspace_id` set, so Postgres itself enforces the
 * boundary: a read that forgets the filter still cannot see another
 * workspace's rows.
 *
 * Cost control (the 2026-09-15 RLS read-latency incident): the driver here
 * is node-postgres via drizzle, and drizzle folds the transaction mode into
 * the `BEGIN` statement itself (`begin read only`), and `bindWorkspaceRls`
 * sets role and workspace in one statement — so the wrapper adds exactly 3
 * round trips to a read (BEGIN, bind, COMMIT). RLS policies use the InitPlan
 * form (`(select current_setting(...))`), so the setting is read once per
 * statement, not once per row. Measured 2026-09-21 on the database itself:
 * the policies add microseconds (10 000-row count: 3.30 ms as postgres,
 * 3.58 ms as app_user); the cost that matters is the network round trips.
 *
 * `READ ONLY` is also a regression tripwire: a `.query()` handler that
 * starts writing will fail loudly instead of silently mutating data on the
 * read path. (A static audit on 2026-09-21 found none.)
 */
export function runInWorkspaceRlsReadonly<T>(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  fn: (tx: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> {
  if (!isValidUuid(workspaceId)) {
    // Belt and suspenders: createTRPCContext already rejects non-UUID
    // x-workspace-id values before any query runs. Re-asserting here keeps
    // the interpolation in this function unconditionally safe.
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "workspaceId debe ser un UUID válido",
    });
  }

  return db.transaction(
    async (tx) => {
      await bindWorkspaceRls(tx, workspaceId);
      return fn(tx as unknown as ReturnType<typeof getDb>);
    },
    // drizzle emits `begin read only` — READ ONLY without an extra round
    // trip, and without needing SET TRANSACTION as the first statement.
    { accessMode: "read only" },
  );
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
    const actor = toWorkspaceActor(ctx.user, resolved);
    assertMfaCompliance(actor);

    const workspace: WorkspaceMembership = {
      workspaceId: resolved.workspaceId,
      memberId: resolved.memberId,
      role: resolved.memberRole,
      plan: resolved.workspacePlan,
    };

    // Execute inside transaction with SET LOCAL for RLS enforcement
    const result = await runInWorkspaceRls(ctx.db, resolved.workspaceId, (tx) =>
      next({
        ctx: {
          ...ctx,
          db: tx,
          user: actor,
          workspace,
        },
      }),
    );

    // Post-commit work (F5.2): runs as `postgres` on the pool, only after the
    // transaction committed, and never fails the mutation that queued it —
    // the write already stands, so a failure here is logged, not thrown.
    for (const task of ctx.afterCommit) {
      try {
        await task(ctx.db);
      } catch (error) {
        ctx.log.error("after-commit task failed", {}, error);
      }
    }
    ctx.afterCommit.length = 0;

    return result;
  },
);

/**
 * Workspace read procedure — every SELECT under RLS as `app_user`
 * (F9.2, finding M9).
 *
 * Membership is still validated and cached first (on the pooled `postgres`
 * connection — see `resolveWorkspaceMembership`). The handler itself then
 * runs inside `runInWorkspaceRlsReadonly`: a READ ONLY transaction with
 * `SET LOCAL ROLE app_user` and `app.workspace_id` set, so the same RLS
 * policies that guard mutations guard reads too. If a query forgets its
 * `workspace_id` WHERE clause, Postgres — not the query author — answers.
 *
 * Use this for all .query() procedures. Keep workspaceProcedure for
 * .mutation().
 *
 * Deliberate exception: a `.mutation()` built on this builder keeps the
 * pooled `postgres` connection as `ctx.db`. Today the only one is
 * `pricing.syncRates`, which performs a slow upstream fetch (BCV/DolarAPI/
 * Frankfurter) BEFORE opening its own short `runInWorkspaceRls` write
 * transaction — wrapping it here would (a) hold the pooled connection for
 * the whole external I/O and (b) make its write impossible inside a READ
 * ONLY transaction. Wrapping by procedure type (`query`) keeps that pattern
 * intact while every actual read gets RLS enforcement.
 */
export const workspaceReadProcedure = protectedProcedure.use(
  async ({ ctx, next, type }) => {
    const resolved = await resolveWorkspaceMembership(ctx);

    const workspace: WorkspaceMembership = {
      workspaceId: resolved.workspaceId,
      memberId: resolved.memberId,
      role: resolved.memberRole,
      plan: resolved.workspacePlan,
    };

    // Every actual read executes under app_user + RLS (defense in depth,
    // M9). Mutations on this builder are the documented exception above.
    if (type !== "query") {
      return next({
        ctx: {
          ...ctx,
          user: toWorkspaceActor(ctx.user, resolved),
          workspace,
        },
      });
    }

    return runInWorkspaceRlsReadonly(ctx.db, resolved.workspaceId, (tx) =>
      next({
        ctx: {
          ...ctx,
          db: tx,
          user: toWorkspaceActor(ctx.user, resolved),
          workspace,
        },
      }),
    );
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
