/**
 * Cendaro — Audit Logger
 *
 * Utility to write immutable audit log entries.
 * Used by all tRPC mutations for traceability (PRD §24).
 */
import crypto from "node:crypto";

import { AuditLog } from "@cendaro/db/schema";

import type {
  AuthenticatedUser,
  createTRPCContext,
  WorkspaceActor,
} from "../trpc";

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

type AuditActor = AuthenticatedUser | WorkspaceActor | null;

interface IntegrityPayload {
  workspaceId?: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * SHA-256 payload checksum stored in `audit_log.metadata`
 * (SOC 1 / SOC 2 Type II processing integrity). Shared with route handlers
 * that write audit rows outside tRPC so every entry is hashed identically.
 */
export function buildAuditIntegrityMetadata(
  payload: IntegrityPayload,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const integrityHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        workspaceId: payload.workspaceId,
        actorId: payload.actorId,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        oldValue: payload.oldValue,
        newValue: payload.newValue,
      }),
    )
    .digest("hex");

  return {
    ...metadata,
    _integrityHash: integrityHash,
    _hashAlgorithm: "sha256",
  };
}

function isWorkspaceActor(user: AuditActor): user is WorkspaceActor {
  return !!user && "workspaceRole" in user;
}

/**
 * Role and name are taken only from DB-verified workspace facts. Outside a
 * workspace procedure the role is unknown (null) and the name falls back to
 * the verified email — never to `user_metadata`, which the user controls.
 */
export async function logAudit(
  db: Db,
  user: AuditActor,
  entry: AuditEntry,
): Promise<string> {
  // Generated here so callers get the id without RETURNING or a racy re-read.
  const id = crypto.randomUUID();
  const actorRole = isWorkspaceActor(user) ? user.workspaceRole : null;
  const actorName =
    (isWorkspaceActor(user) ? user.displayName : null) ??
    user?.email ??
    "system";

  const metadataWithIntegrity = buildAuditIntegrityMetadata(
    { ...entry, actorId: user?.id },
    entry.metadata,
  );

  await db.insert(AuditLog).values({
    id,
    workspaceId: entry.workspaceId,
    actorId: user?.id,
    actorRole,
    actorName,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    metadata: metadataWithIntegrity,
    correlationId: entry.correlationId,
  });

  return id;
}
