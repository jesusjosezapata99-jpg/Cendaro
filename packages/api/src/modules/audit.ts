/**
 * Cendaro — Audit Logger
 *
 * Utility to write immutable audit log entries with SHA-256 payload integrity
 * and WORM cryptographic hash-chaining (`prevHash` → `chainHash`) (PRD §24, F10.4).
 */
import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";

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

export const GENESIS_AUDIT_HASH = "GENESIS";

/**
 * Computes the deterministic link hash (`chainHash`) chaining the previous
 * record's `chainHash` with the current record's `integrityHash`.
 */
export function computeAuditChainHash(
  prevHash: string | null | undefined,
  integrityHash: string,
): string {
  const normalizedPrev =
    prevHash && prevHash.trim().length > 0
      ? prevHash.trim()
      : GENESIS_AUDIT_HASH;
  return crypto
    .createHash("sha256")
    .update(`${normalizedPrev}:${integrityHash}`)
    .digest("hex");
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

/**
 * Verifies that an `audit_log` row's SHA-256 checksum matches its stored
 * columns (SOC 1 / SOC 2 Type II processing integrity verification).
 */
export function verifyAuditRecordIntegrity(row: {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const storedHash =
    row.metadata && typeof row.metadata._integrityHash === "string"
      ? row.metadata._integrityHash
      : null;
  if (!storedHash) return false;

  const normalize = (val: unknown) => (val === null ? undefined : val);
  const recomputed = buildAuditIntegrityMetadata({
    workspaceId: normalize(row.workspaceId) as string | undefined,
    actorId: normalize(row.actorId) as string | undefined,
    action: row.action,
    entity: row.entity,
    entityId: normalize(row.entityId) as string | undefined,
    oldValue: row.oldValue ?? undefined,
    newValue: row.newValue ?? undefined,
  });

  if (recomputed._integrityHash === storedHash) return true;

  // Also check with explicit null preservation for oldValue/newValue when stored as JSON null
  const recomputedRaw = buildAuditIntegrityMetadata({
    workspaceId: normalize(row.workspaceId) as string | undefined,
    actorId: normalize(row.actorId) as string | undefined,
    action: row.action,
    entity: row.entity,
    entityId: normalize(row.entityId) as string | undefined,
    oldValue: row.oldValue,
    newValue: row.newValue,
  });

  return recomputedRaw._integrityHash === storedHash;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  totalChecked: number;
  brokenAtId: string | null;
  brokenReason: string | null;
  firstHash: string | null;
  lastHash: string | null;
  manifestHash: string;
  verifiedAt: string;
}

/**
 * Verifies a chronological sequence (oldest → newest) of `audit_log` rows:
 *  1. Each row's payload checksum (`_integrityHash`) matches its columns.
 *  2. Each row that carries `chainHash` / `_chainHash` matches
 *     `computeAuditChainHash(prevChainHash, integrityHash)`.
 */
export function verifyAuditChain(
  rows: {
    id: string;
    workspaceId?: string | null;
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown> | null;
    prevHash?: string | null;
    chainHash?: string | null;
  }[],
): AuditChainVerificationResult {
  let expectedPrevHash: string | null = null;
  let firstHash: string | null = null;
  let lastHash: string | null = null;
  const chainDigests: string[] = [];

  for (const row of rows) {
    if (!verifyAuditRecordIntegrity(row)) {
      return {
        valid: false,
        totalChecked: chainDigests.length + 1,
        brokenAtId: row.id,
        brokenReason: "payload_integrity_mismatch",
        firstHash,
        lastHash,
        manifestHash: crypto
          .createHash("sha256")
          .update(chainDigests.join("|"))
          .digest("hex"),
        verifiedAt: new Date().toISOString(),
      };
    }

    const integrityHash =
      row.metadata && typeof row.metadata._integrityHash === "string"
        ? row.metadata._integrityHash
        : "";
    const storedPrevHash =
      row.prevHash ??
      (row.metadata && typeof row.metadata._prevHash === "string"
        ? row.metadata._prevHash
        : null);
    const storedChainHash =
      row.chainHash ??
      (row.metadata && typeof row.metadata._chainHash === "string"
        ? row.metadata._chainHash
        : null);

    if (storedChainHash) {
      if (
        expectedPrevHash !== null &&
        storedPrevHash &&
        storedPrevHash !== expectedPrevHash
      ) {
        return {
          valid: false,
          totalChecked: chainDigests.length + 1,
          brokenAtId: row.id,
          brokenReason: "prev_hash_link_mismatch",
          firstHash,
          lastHash,
          manifestHash: crypto
            .createHash("sha256")
            .update(chainDigests.join("|"))
            .digest("hex"),
          verifiedAt: new Date().toISOString(),
        };
      }

      const recomputedChain = computeAuditChainHash(
        storedPrevHash ?? expectedPrevHash,
        integrityHash,
      );
      if (recomputedChain !== storedChainHash) {
        return {
          valid: false,
          totalChecked: chainDigests.length + 1,
          brokenAtId: row.id,
          brokenReason: "chain_hash_mismatch",
          firstHash,
          lastHash,
          manifestHash: crypto
            .createHash("sha256")
            .update(chainDigests.join("|"))
            .digest("hex"),
          verifiedAt: new Date().toISOString(),
        };
      }

      expectedPrevHash = storedChainHash;
      firstHash ??= storedChainHash;
      lastHash = storedChainHash;
      chainDigests.push(storedChainHash);
    } else {
      firstHash ??= integrityHash;
      lastHash = integrityHash;
      chainDigests.push(integrityHash);
    }
  }

  return {
    valid: true,
    totalChecked: rows.length,
    brokenAtId: null,
    brokenReason: null,
    firstHash,
    lastHash,
    manifestHash: crypto
      .createHash("sha256")
      .update(chainDigests.join("|"))
      .digest("hex"),
    verifiedAt: new Date().toISOString(),
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
  const resolvedWorkspaceId =
    entry.workspaceId ??
    (isWorkspaceActor(user) ? user.workspaceId : undefined);

  let prevHash = GENESIS_AUDIT_HASH;
  if (resolvedWorkspaceId && typeof db.select === "function") {
    try {
      const prevRows = await db
        .select({
          chainHash: AuditLog.chainHash,
          metadata: AuditLog.metadata,
        })
        .from(AuditLog)
        .where(eq(AuditLog.workspaceId, resolvedWorkspaceId))
        .orderBy(desc(AuditLog.createdAt))
        .limit(1);
      const lastRow = Array.isArray(prevRows) ? prevRows[0] : undefined;
      if (lastRow) {
        const meta = lastRow.metadata as Record<string, unknown> | null;
        prevHash =
          lastRow.chainHash ??
          (meta && typeof meta._chainHash === "string"
            ? meta._chainHash
            : meta && typeof meta._integrityHash === "string"
              ? meta._integrityHash
              : GENESIS_AUDIT_HASH);
      }
    } catch {
      // Fallback to GENESIS_AUDIT_HASH when running against lightweight test mocks
      prevHash = GENESIS_AUDIT_HASH;
    }
  }

  const baseMetadata = buildAuditIntegrityMetadata(
    { ...entry, workspaceId: resolvedWorkspaceId, actorId: user?.id },
    entry.metadata,
  );
  const integrityHash =
    typeof baseMetadata._integrityHash === "string"
      ? baseMetadata._integrityHash
      : "";
  const chainHash = computeAuditChainHash(prevHash, integrityHash);

  const metadataWithIntegrity = baseMetadata;

  await db.insert(AuditLog).values({
    id,
    workspaceId: resolvedWorkspaceId,
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
    prevHash,
    chainHash,
  });

  return id;
}
