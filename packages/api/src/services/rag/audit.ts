/**
 * Cendaro — Phase 4 Tamper-Evident RAG Audit Chain & Security Telemetry Service
 *
 * Implements:
 *   1. Recursive canonical SHA-256 payload digest and per-workspace hash-chain
 *      computation (`computePayloadHash`, `computeChainHash`, `computeSqlAuditHashes`,
 *      `verifyRagAuditChainIntegrity`) preserving nested `metadata` tamper sensitivity.
 *   2. Transaction-safe, PII-scrubbed audit logging (`logRagAuditEvent`) into
 *      `public.rag_audit_log` using SAVEPOINT isolation ONLY for pre-036 rollout
 *      (`42P01`) while failing closed (rethrowing) on real SQL integrity/WORM errors
 *      so PostgreSQL transactions never enter silent `TBLOCK_ABORT` rollback.
 *   3. Structured security & performance telemetry emitted through Cendaro's
 *      server logger (OpenTelemetry / Sentry compatible).
 */

import * as crypto from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

import { ragAuditLog } from "@cendaro/db/schema";

import { logger } from "../../logger";
import { sanitizeDocumentStructuralContent } from "./guardrails";
import { tokenizeAndVaultContent } from "./pii-vault";

// ──────────────────────────────────────────────
// Types & Interfaces
// ──────────────────────────────────────────────

export type RagAuditOperationType =
  "search" | "ingest" | "delete" | "guardrail_violation" | "llm_completion";

export interface AuditLogRecord {
  id: string;
  workspaceId: string;
  seq: number;
  timestamp?: string;
  prevHash: string;
  payloadHash: string;
  chainHash: string;
  operationType: RagAuditOperationType;
  userId?: string | null;
  queryText?: string | null;
  promptHash?: string;
  promptTemplateHash?: string;
  retrievedChunkIds?: string[];
  outputHash?: string;
  metadata?: Record<string, unknown>;
  /** Exact `metadata::text` returned by PostgreSQL when verifying SQL trigger rows. */
  metadataText?: string;
  /** Set true when verifying rows loaded directly from `public.rag_audit_log` SQL trigger format. */
  sqlFormat?: boolean;
}

export interface RagAuditChainVerificationResult {
  broken_prev_link: number;
  unhashed_tail_gap: number;
  payload_tampered: number;
}

export interface RagAuditEventInput {
  workspaceId: string;
  userId?: string | null;
  operationType: RagAuditOperationType;
  queryText?: string;
  promptTemplateHash?: string;
  retrievedChunkIds?: string[];
  outputHash?: string;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

// ──────────────────────────────────────────────
// 1. Cryptographic Digest & Verification Primitives
// ──────────────────────────────────────────────

/**
 * Recursively canonicalizes JSON values by sorting object keys at EVERY nesting depth
 * (avoiding ECMA-262 §25.5.2's array-replacer allowlist bug that strips nested keys).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalizeJson(item))).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`,
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Computes a deterministic SHA-256 hex digest over recursively canonicalized audit payload keys.
 */
export function computePayloadHash(payload: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(canonicalizeJson(payload), "utf-8")
    .digest("hex");
}

/**
 * Computes a SHA-256 hex chain link binding `prevHash`, `payloadHash`, `seq`, and optional `timestamp`.
 */
export function computeChainHash(
  prevHash: string,
  payloadHash: string,
  seq: number,
  timestamp?: string,
): string {
  const preimage =
    timestamp !== undefined
      ? `${prevHash}:${payloadHash}:${seq}:${timestamp}`
      : `${prevHash}:${payloadHash}:${seq}`;
  return crypto.createHash("sha256").update(preimage, "utf-8").digest("hex");
}

/**
 * Computes the exact SHA-256 `payload_hash` and `chain_hash` preimage produced by
 * PostgreSQL trigger `public.rag_audit_log_chain()` in `036_rag_audit_log.sql`.
 */
export function computeSqlAuditHashes(row: {
  workspaceId: string;
  userId?: string | null;
  operationType: string;
  queryText?: string | null;
  promptTemplateHash: string;
  retrievedChunkIds: readonly string[];
  outputHash: string;
  metadataText: string;
  prevHash: string;
  seq: number;
}): { payloadHash: string; chainHash: string } {
  const frame = (val: string): string =>
    `${Buffer.byteLength(val, "utf-8")}#${val}`;
  const payloadPreimage = [
    frame(row.workspaceId),
    frame(row.userId ?? "system"),
    frame(row.operationType),
    frame(row.queryText ?? ""),
    frame(row.promptTemplateHash),
    frame(row.retrievedChunkIds.join(",")),
    frame(row.outputHash),
    frame(row.metadataText),
  ].join("|");
  const payloadHash = crypto
    .createHash("sha256")
    .update(payloadPreimage, "utf-8")
    .digest("hex");
  const chainHash = crypto
    .createHash("sha256")
    .update(`${row.prevHash}:${payloadHash}:${row.seq}`, "utf-8")
    .digest("hex");
  return { payloadHash, chainHash };
}

/**
 * Computes a fast SHA-256 hex digest of an arbitrary string.
 */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf-8").digest("hex");
}

/**
 * Verifies an ordered or unordered set of `AuditLogRecord` items partitioned by workspace,
 * checking sequence link continuity (`GENESIS_RAG` -> `prevHash`), unhashed tail gaps,
 * and recomputed SHA-256 payload + chain digests (supporting both canonical JSON records
 * and SQL trigger `036_rag_audit_log` records).
 */
export function verifyRagAuditChainIntegrity(
  records: AuditLogRecord[],
): RagAuditChainVerificationResult {
  let broken_prev_link = 0;
  let unhashed_tail_gap = 0;
  let payload_tampered = 0;

  const workspaceGroups = new Map<string, AuditLogRecord[]>();
  for (const rec of records) {
    const list = workspaceGroups.get(rec.workspaceId) ?? [];
    list.push(rec);
    workspaceGroups.set(rec.workspaceId, list);
  }

  for (const [, list] of workspaceGroups) {
    const sorted = [...list].sort((a, b) => a.seq - b.seq);
    let expectedPrev = "GENESIS_RAG";

    for (const row of sorted) {
      if (!row.chainHash || !row.payloadHash) {
        unhashed_tail_gap++;
      }

      if (row.prevHash !== expectedPrev) {
        broken_prev_link++;
      }

      if (row.sqlFormat || row.timestamp === undefined) {
        const { payloadHash: expectedPayload, chainHash: expectedChain } =
          computeSqlAuditHashes({
            workspaceId: row.workspaceId,
            userId: row.userId,
            operationType: row.operationType,
            queryText: row.queryText,
            promptTemplateHash: row.promptTemplateHash ?? row.promptHash ?? "",
            retrievedChunkIds: row.retrievedChunkIds ?? [],
            outputHash: row.outputHash ?? "",
            metadataText:
              row.metadataText ?? JSON.stringify(row.metadata ?? {}),
            prevHash: row.prevHash,
            seq: row.seq,
          });
        if (
          row.payloadHash !== expectedPayload ||
          row.chainHash !== expectedChain
        ) {
          payload_tampered++;
        }
      } else {
        const payloadObj: Record<string, unknown> = {
          workspaceId: row.workspaceId,
          userId: row.userId ?? undefined,
          operationType: row.operationType,
          queryText: row.queryText ?? undefined,
          promptHash: row.promptHash,
          retrievedChunkIds: row.retrievedChunkIds,
          outputHash: row.outputHash,
          metadata: row.metadata,
        };
        const expectedPayloadHash = computePayloadHash(payloadObj);
        if (row.payloadHash !== expectedPayloadHash) {
          payload_tampered++;
        } else {
          const expectedChainHash = computeChainHash(
            row.prevHash,
            row.payloadHash,
            row.seq,
            row.timestamp,
          );
          if (row.chainHash !== expectedChainHash) {
            payload_tampered++;
          }
        }
      }

      expectedPrev = row.chainHash;
    }
  }

  return { broken_prev_link, unhashed_tail_gap, payload_tampered };
}

// ──────────────────────────────────────────────
// 2. Database Audit Persistence & Structured Telemetry
// ──────────────────────────────────────────────

/**
 * Scrubs any accidental PII or structural injection tokens from `queryText`
 * before persisting into `rag_audit_log`, ensuring WORM audit rows never store
 * cleartext fiscal/banking identifiers.
 */
export function sanitizeAuditQueryText(
  queryText: string | undefined,
  workspaceId: string,
): string | null {
  if (!queryText) return null;
  const clean = sanitizeDocumentStructuralContent(queryText).trim();
  if (!clean) return null;
  const { sanitizedContent } = tokenizeAndVaultContent(
    clean.slice(0, 1000),
    workspaceId,
    "audit",
  );
  return sanitizedContent;
}

/**
 * Recursively scrubs string values inside audit `metadata` so fiscal IDs
 * (e.g. a SENIAT RIF placed inside `documentNumber`) are never permanently
 * baked in cleartext into append-only WORM `public.rag_audit_log` (MED-02).
 */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
  workspaceId: string,
): Record<string, unknown> {
  if (!metadata) return {};

  const scrubValue = (val: unknown, key?: string): unknown => {
    if (typeof val === "string") {
      // Preserve known internal UUID / enum keys untouched; scrub free-text / document numbers
      if (
        key === "documentId" ||
        key === "documentType" ||
        key === "role" ||
        key === "action"
      ) {
        return val;
      }
      const clean = sanitizeDocumentStructuralContent(val).trim();
      return tokenizeAndVaultContent(clean, workspaceId, "audit")
        .sanitizedContent;
    }
    if (Array.isArray(val)) {
      return val.map((item) => scrubValue(item));
    }
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = scrubValue(v, k);
      }
      return out;
    }
    return val;
  };

  return scrubValue(metadata) as Record<string, unknown>;
}

/**
 * Persists a tamper-evident RAG audit event inside an active workspace-scoped
 * Drizzle database/transaction context and emits structured observability logs.
 *
 * Uses a PostgreSQL SAVEPOINT ONLY to tolerate `42P01` (`undefined_table`) when
 * migration `036_rag_audit_log` has not yet been applied during rollout; all
 * other database errors rethrow so active transactions fail closed instead of
 * entering `TBLOCK_ABORT` silent rollback (HIGH-01).
 */
export async function logRagAuditEvent(
  db:
    | Pick<NodePgDatabase<Record<string, unknown>>, "insert" | "execute">
    | Pick<NodePgDatabase<Record<string, unknown>>, "insert">
    | undefined,
  event: RagAuditEventInput,
): Promise<void> {
  const safeQueryText = sanitizeAuditQueryText(
    event.queryText,
    event.workspaceId,
  );
  const safeMetadata = sanitizeAuditMetadata(event.metadata, event.workspaceId);
  const promptHash =
    event.promptTemplateHash ?? sha256Hex(`rag:${event.operationType}:v1`);
  const outputHash = event.outputHash ?? sha256Hex("");
  const tokenUsage = {
    prompt: event.tokenUsage?.prompt ?? 0,
    completion: event.tokenUsage?.completion ?? 0,
    total: event.tokenUsage?.total ?? 0,
  };

  if (event.operationType === "guardrail_violation") {
    logger.warn("rag guardrail violation intercepted", {
      module: "rag-security",
      workspaceId: event.workspaceId,
      operationType: event.operationType,
      latencyMs: event.latencyMs ?? 0,
      metadata: safeMetadata,
    });
  } else {
    logger.info("rag audit event recorded", {
      module: "rag-audit",
      workspaceId: event.workspaceId,
      operationType: event.operationType,
      chunkCount: event.retrievedChunkIds?.length ?? 0,
      latencyMs: event.latencyMs ?? 0,
    });
  }

  if (!db || typeof (db as { insert?: unknown }).insert !== "function") {
    return;
  }

  const execFn = (
    db as { execute?: (q: ReturnType<typeof sql>) => Promise<unknown> }
  ).execute;
  const hasSavepointSupport = typeof execFn === "function";

  if (hasSavepointSupport) {
    await execFn.call(db, sql`SAVEPOINT rag_audit_sp`);
  }

  try {
    const insertBuilder = db.insert(ragAuditLog) as unknown as
      | { values?: (val: Record<string, unknown>) => Promise<unknown> }
      | undefined;
    if (typeof insertBuilder?.values === "function") {
      await insertBuilder.values({
        workspaceId: event.workspaceId,
        userId: event.userId ?? null,
        operationType: event.operationType,
        queryText: safeQueryText,
        promptTemplateHash: promptHash,
        retrievedChunkIds: event.retrievedChunkIds ?? [],
        outputHash,
        metadata: safeMetadata,
        latencyMs: Math.max(0, Math.round(event.latencyMs ?? 0)),
        tokenUsage,
      });
    }
    if (hasSavepointSupport) {
      await execFn.call(db, sql`RELEASE SAVEPOINT rag_audit_sp`);
    }
  } catch (err) {
    const pgCode = (err as { code?: string } | null)?.code;
    if (pgCode === "42P01" && hasSavepointSupport) {
      // Migration 036_rag_audit_log not yet applied: restore transaction cleanly out of TBLOCK_ABORT
      await execFn.call(db, sql`ROLLBACK TO SAVEPOINT rag_audit_sp`);
      await execFn.call(db, sql`RELEASE SAVEPOINT rag_audit_sp`);
      logger.warn(
        "rag_audit_log table not yet installed (42P01); skipped WORM DB row",
        {
          module: "rag-audit",
          workspaceId: event.workspaceId,
          operationType: event.operationType,
        },
      );
      return;
    }
    // Fail closed: rethrow so active mutation transactions abort visibly with HTTP 500
    throw err;
  }
}
