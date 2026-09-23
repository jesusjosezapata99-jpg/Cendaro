/**
 * Server-side idle-session enforcement (PLAN-2026-09-SECURITY-REMEDIATION
 * F7.1, finding M2).
 *
 * Before this, the idle timeout was an httpOnly cookie checked only in
 * apps/erp/src/proxy.ts, on page navigations. `/api/*` — including
 * `/api/trpc` — skips proxy.ts entirely ("API/tRPC routes handle their own
 * auth"), so a caller that only ever hits tRPC directly (a replayed access
 * token, not a browser) never went through the idle check: the JWT stayed
 * good for its full lifetime regardless of inactivity. The cookie is also
 * client-visible state, evidence of activity rather than proof of it.
 *
 * This keeps the server's own record, keyed by the JWT's `session_id` claim
 * (required on every Supabase access token), and is called from
 * `protectedProcedure` — the single choke point every procedure builder in
 * trpc.ts is built from, so it covers every authenticated call, tRPC batch
 * or not.
 *
 * Privileges: `user_session_activity` is reachable only by roles that bypass
 * RLS, so this must run on the pooled `postgres` connection — before `SET
 * LOCAL ROLE app_user`, exactly where `protectedProcedure` sits.
 */
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";

import type { ILogger } from "../logger";
import { logger } from "../logger";

type Db = ReturnType<typeof getDb>;

/** PRD §7 / plan F7.1: 30 minutes of inactivity ends the session. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1_000;

/**
 * Verifies `sessionId` was active within `IDLE_TIMEOUT_MS`, then records this
 * call as new activity. Throws UNAUTHORIZED — without touching the row —
 * when the session has gone idle past the limit, so a reused, long-idle
 * token cannot resurrect itself by being used again.
 *
 * Fails open on a database error: this is a defense-in-depth control layered
 * on top of `is_workspace_member()` and RLS, not the primary authentication
 * boundary (the JWT signature is), so an outage here must not become a
 * platform-wide outage. The failure is logged so it does not pass silently.
 */
export async function touchSessionActivity(
  db: Db,
  sessionId: string,
  userId: string,
  now: number,
  options: { log?: ILogger } = {},
): Promise<void> {
  const log = options.log ?? logger;
  try {
    const { rows } = await db.execute<{ last_seen_at: string }>(
      sql`SELECT last_seen_at FROM public.user_session_activity WHERE session_id = ${sessionId}::uuid`,
    );
    const lastSeenAt = rows[0]?.last_seen_at;
    if (lastSeenAt && now - new Date(lastSeenAt).getTime() > IDLE_TIMEOUT_MS) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sesión expirada por inactividad. Vuelve a iniciar sesión.",
      });
    }

    await db.execute(sql`
      INSERT INTO public.user_session_activity (session_id, user_id, last_seen_at)
      VALUES (${sessionId}::uuid, ${userId}::uuid, to_timestamp(${now / 1000}))
      ON CONFLICT (session_id) DO UPDATE
        SET last_seen_at = EXCLUDED.last_seen_at
    `);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    log.error(
      "could not verify session activity; allowing the call through",
      { sessionId },
      error,
    );
  }
}
