/**
 * Cendaro — Workspace seat quota (PLAN-2026-09-SECURITY-REMEDIATION F3).
 *
 * The enforce_workspace_quota trigger only fires BEFORE INSERT of an active
 * member, so it never sees pending invitations, an invitation being accepted
 * or a suspended member being reactivated (both UPDATEs). Every path that
 * gives someone a seat checks it here.
 */
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray } from "drizzle-orm";

import { WorkspaceMember, WorkspaceQuota } from "@cendaro/db/schema";

import type { logAudit } from "./audit";

type Db = Parameters<typeof logAudit>[0];
export type MemberStatus = (typeof WorkspaceMember.$inferSelect)["status"];

/**
 * Serializes seat changes of one workspace by locking its quota row, then
 * rejects the change when the members in `countedStatuses` already fill
 * max_users. A missing quota row or a negative limit means unlimited (the
 * trigger treats NULL the same way).
 */
export async function assertSeatAvailable(
  db: Db,
  workspaceId: string,
  countedStatuses: MemberStatus[],
): Promise<void> {
  const [quota] = await db
    .select({ maxUsers: WorkspaceQuota.maxUsers })
    .from(WorkspaceQuota)
    .where(eq(WorkspaceQuota.workspaceId, workspaceId))
    .limit(1)
    .for("update");
  if (!quota || quota.maxUsers < 0) return;

  const [seats] = await db
    .select({ count: count() })
    .from(WorkspaceMember)
    .where(
      and(
        eq(WorkspaceMember.workspaceId, workspaceId),
        inArray(WorkspaceMember.status, countedStatuses),
      ),
    );
  if ((seats?.count ?? 0) >= quota.maxUsers) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "El workspace alcanzó el límite de usuarios de su plan. Libera un puesto o cambia de plan.",
    });
  }
}
