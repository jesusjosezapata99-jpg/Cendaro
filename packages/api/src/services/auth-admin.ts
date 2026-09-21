/**
 * Effective session revocation (PLAN-2026-09-SECURITY-REMEDIATION F5.2,
 * finding H5).
 *
 * Suspending or removing a member only changed `workspace_member.status`. The
 * person's GoTrue session survived: their refresh token still minted new
 * access tokens, so they kept a valid identity and regained access the moment
 * any membership was restored — and kept reading other workspaces meanwhile.
 *
 * GoTrue has no admin endpoint that logs out another person by id
 * (`auth.admin.signOut` needs that user's own JWT, which the server never
 * holds), so revocation is done in the database: deleting `auth.sessions`
 * invalidates the refresh tokens attached to them. Already-issued access
 * tokens stay valid until they expire, which is why migration 018 also makes
 * `is_workspace_member()` reject a non-active profile or workspace — the two
 * together close the window.
 *
 * Privileges: these statements run as the pooled `postgres` role, never as
 * `app_user` (which has no rights on the `auth` schema). They must therefore
 * run OUTSIDE the workspace RLS transaction — see `ctx.afterCommit` in
 * `trpc.ts`, which also guarantees the membership change is committed before
 * the sessions are dropped.
 */
import { sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";

import type { ILogger } from "../logger";
import { logger } from "../logger";

type Db = ReturnType<typeof getDb>;

export interface RevocationResult {
  /** True when the person still holds access somewhere, so nothing was done. */
  keptAccess: boolean;
  /** Sessions deleted. */
  revoked: number;
  /** Set when the revocation itself failed; the caller's write already stands. */
  failed?: true;
}

/**
 * True while the person is an active member of at least one active workspace
 * and their profile is active — the same three conditions `is_workspace_member`
 * checks after migration 018.
 */
async function hasActiveAccess(db: Db, userId: string): Promise<boolean> {
  const { rows } = await db.execute<{ ok: number }>(
    sql`SELECT 1 AS ok
        FROM public.workspace_member m
        JOIN public.user_profile p ON p.id = m.user_id AND p.status = 'active'
        JOIN public.workspace w ON w.id = m.workspace_id AND w.status = 'active'
        WHERE m.user_id = ${userId}::uuid
          AND m.status = 'active'
        LIMIT 1`,
  );
  return rows.length > 0;
}

/**
 * Deletes every GoTrue session of one person and returns how many were
 * dropped. Refresh tokens cascade with their session; the second statement
 * also clears tokens left without one.
 */
export async function revokeUserSessions(
  db: Db,
  userId: string,
): Promise<number> {
  const { rows } = await db.execute<{ id: string }>(
    sql`DELETE FROM auth.sessions WHERE user_id = ${userId}::uuid RETURNING id`,
  );
  await db.execute(
    sql`DELETE FROM auth.refresh_tokens WHERE user_id = ${userId}::text`,
  );
  return rows.length;
}

/**
 * Revokes the sessions of `userId` unless they still hold active access
 * somewhere. Never throws: it runs after the membership change is committed,
 * so failing here must not turn a successful suspension into an error — it is
 * logged instead, and the next login is already blocked by the membership.
 */
export async function revokeSessionsIfAccessLost(
  db: Db,
  userId: string,
  options: { log?: ILogger } = {},
): Promise<RevocationResult> {
  const log = options.log ?? logger;
  try {
    if (await hasActiveAccess(db, userId)) {
      return { keptAccess: true, revoked: 0 };
    }
    const revoked = await revokeUserSessions(db, userId);
    log.info("sessions revoked after losing workspace access", {
      userId,
      revoked,
    });
    return { keptAccess: false, revoked };
  } catch (error) {
    log.error(
      "could not revoke sessions after a membership change",
      { userId },
      error,
    );
    return { keptAccess: false, revoked: 0, failed: true };
  }
}
