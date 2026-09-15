/**
 * Cendaro — Audit Logger
 *
 * Utility to write immutable audit log entries.
 * Used by all tRPC mutations for traceability (PRD §24).
 */
import crypto from "node:crypto";

import type { userRoleEnum } from "@cendaro/db/schema";
import { AuditLog } from "@cendaro/db/schema";

import type { AuthenticatedUser, createTRPCContext } from "../trpc";

type Db = ReturnType<typeof createTRPCContext>["db"];

interface AuditEntry {
  workspaceId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

type UserWithMeta =
  | (AuthenticatedUser & {
      user_metadata?: {
        role?: (typeof userRoleEnum.enumValues)[number];
        full_name?: string;
      };
    })
  | null;

export async function logAudit(db: Db, user: UserWithMeta, entry: AuditEntry) {
  const meta = user?.user_metadata;
  const actorName = meta?.full_name ?? user?.email ?? "system";

  // Compute SHA-256 cryptographic payload integrity checksum (SOC 1 / SOC 2 Type II processing integrity)
  const payloadString = JSON.stringify({
    workspaceId: entry.workspaceId,
    actorId: user?.id,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
  });
  const integrityHash = crypto
    .createHash("sha256")
    .update(payloadString)
    .digest("hex");

  const metadataWithIntegrity = {
    ...(entry.metadata ?? {}),
    _integrityHash: integrityHash,
    _hashAlgorithm: "sha256",
  };

  await db.insert(AuditLog).values({
    workspaceId: entry.workspaceId,
    actorId: user?.id,
    actorRole: meta?.role ?? null,
    actorName,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    metadata: metadataWithIntegrity,
    correlationId: entry.correlationId,
  });
}
