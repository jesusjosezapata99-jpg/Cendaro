/**
 * Cendaro — Audit Logger
 *
 * Utility to write immutable audit log entries.
 * Used by all tRPC mutations for traceability (PRD §24).
 */
import type { User } from "@supabase/supabase-js";

import { AuditLog } from "@cendaro/db/schema";
import type { userRoleEnum } from "@cendaro/db/schema";

import type { createTRPCContext } from "../trpc";

type Db = ReturnType<typeof createTRPCContext>["db"];

interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

type UserWithMeta =
  | (User & {
      user_metadata?: { role?: (typeof userRoleEnum.enumValues)[number]; full_name?: string };
    })
  | null;

export async function logAudit(
  db: Db,
  user: UserWithMeta,
  entry: AuditEntry,
) {
  const meta = user?.user_metadata;
  const actorName = meta?.full_name ?? user?.email ?? "system";

  await db.insert(AuditLog).values({
    actorId: user?.id,
    actorRole: meta?.role ?? null,
    actorName,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue as Record<string, unknown> | null,
    newValue: entry.newValue as Record<string, unknown> | null,
    metadata: entry.metadata ?? null,
    correlationId: entry.correlationId,
  });
}
