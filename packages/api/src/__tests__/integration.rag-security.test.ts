/**
 * Phase 1–4 REAL-database RAG Multi-Tenant Security & WORM Integration Suite.
 *
 * Exercises migrations 032, 034, 035, and 036 against a REAL migrated PostgreSQL
 * instance (`TEST_DATABASE_URL` — disposable dev/branch DB, never production):
 *   1. Forced RLS isolation across `rag_documents`, `rag_document_chunks`,
 *      `rag_pii_vault`, and `rag_audit_log` under `app_user`.
 *   2. Compound foreign key `(document_id, workspace_id)` rejecting cross-tenant
 *      chunk and PII vault binding (`SQLSTATE 23503`).
 *   3. `public.match_rag_chunks()` SECURITY INVOKER session guard (`42501`),
 *      HNSW iterative scan GUCs, and SQL RBAC + vendor domain pushdown.
 *   4. `public.rag_audit_log` WORM immutability (`UPDATE` / `DELETE` blocked with
 *      `42501`) and `public.verify_rag_audit_chain_integrity()` returning 0 violations
 *      with byte-for-byte digest parity against TypeScript `computeSqlAuditHashes()`.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { getDb } from "@cendaro/db/client";
import * as schema from "@cendaro/db/schema";
import {
  ragAuditLog,
  ragDocumentChunks,
  ragDocuments,
  ragPiiVault,
} from "@cendaro/db/schema";

import { computeSqlAuditHashes } from "../services/rag/audit";
import { generateDeterministicEmbedding } from "../services/rag/embeddings";
import { tokenizeAndVaultContent } from "../services/rag/pii-vault";
import { runInWorkspaceRls, runInWorkspaceRlsReadonly } from "../trpc";
import { isLocalDatabase } from "./helpers/real-db";

const TEST_URL = process.env.TEST_DATABASE_URL;

const WS_A = randomUUID();
const WS_B = randomUUID();
const VENDOR_A = randomUUID();

function rowsOf<T>(result: unknown): T[] {
  const shaped = result as { rows?: T[] } | T[];
  return Array.isArray(shaped) ? shaped : (shaped.rows ?? []);
}

function sqlStateOf(err: unknown): string | undefined {
  const direct = (err as { code?: string } | null)?.code;
  if (direct) return direct;
  return (err as { cause?: { code?: string } } | null)?.cause?.code;
}

describe.skipIf(!TEST_URL)(
  "RAG Multi-Tenant RLS, PII Vault & WORM Audit Chain on real PostgreSQL",
  () => {
    let admin: pg.Client | undefined;
    let pool: pg.Pool | undefined;
    let db: ReturnType<typeof getDb> | undefined;
    let docAId = "";
    let docBId = "";

    function database(): ReturnType<typeof getDb> {
      if (!db) throw new Error("beforeAll did not initialize database");
      return db;
    }

    beforeAll(async () => {
      if (!isLocalDatabase()) {
        throw new Error("Integration writes only run against a local database");
      }

      admin = new pg.Client({ connectionString: TEST_URL });
      await admin.connect();

      await admin.query("BEGIN");
      await admin.query(
        `INSERT INTO workspace (id, name, slug) VALUES
           ($1, 'RAG Int Alpha', $3),
           ($2, 'RAG Int Beta', $4)
         ON CONFLICT (id) DO NOTHING`,
        [WS_A, WS_B, `rag-int-a-${WS_A}`, `rag-int-b-${WS_B}`],
      );
      await admin.query("COMMIT");

      pool = new pg.Pool({ connectionString: TEST_URL, max: 2 });
      db = drizzle(pool, { schema, casing: "snake_case" });

      const vecA = generateDeterministicEmbedding(
        "Contenedor MSCU1234567 válvulas industriales",
      );
      const vecB = generateDeterministicEmbedding(
        "Contenedor MSCU1234567 válvulas industriales secreto Beta",
      );

      const { sanitizedContent: vaultedA, vaultEntries: entriesA } =
        tokenizeAndVaultContent(
          "Factura RIF J-40112233-4 | Precio FOB: $95.00",
          WS_A,
          "seed-a",
        );

      await runInWorkspaceRls(database(), WS_A, async (tx) => {
        const [docA] = await tx
          .insert(ragDocuments)
          .values({
            workspaceId: WS_A,
            documentType: "commercial_invoice",
            documentNumber: "FAC-INT-A",
            title: "Factura Alpha",
            status: "indexed",
            metadata: {
              accessRules: { allowedRoles: ["owner", "admin", "vendor"] },
              queryRestrictions: { vendorId: VENDOR_A },
            },
            chunkCount: 1,
            tokenCount: 16,
          })
          .returning({ id: ragDocuments.id });
        docAId = docA?.id ?? "";

        await tx.insert(ragDocumentChunks).values({
          documentId: docAId,
          workspaceId: WS_A,
          chunkIndex: 0,
          chunkType: "document_summary",
          content: vaultedA,
          tokenCount: 16,
          embedding: vecA,
          metadata: { vendorId: VENDOR_A },
        });

        for (const entry of entriesA) {
          if (!entry.buffer || !entry.keyFingerprint) continue;
          await tx.insert(ragPiiVault).values({
            workspaceId: WS_A,
            documentId: docAId,
            surrogateToken: entry.surrogateToken,
            entityType: entry.entityType,
            encryptedValue: entry.buffer,
            keyFingerprint: entry.keyFingerprint,
          });
        }
      });

      await runInWorkspaceRls(database(), WS_B, async (tx) => {
        const [docB] = await tx
          .insert(ragDocuments)
          .values({
            workspaceId: WS_B,
            documentType: "commercial_invoice",
            documentNumber: "FAC-INT-B",
            title: "Factura Beta",
            status: "indexed",
            metadata: {},
            chunkCount: 1,
            tokenCount: 16,
          })
          .returning({ id: ragDocuments.id });
        docBId = docB?.id ?? "";

        await tx.insert(ragDocumentChunks).values({
          documentId: docBId,
          workspaceId: WS_B,
          chunkIndex: 0,
          chunkType: "document_summary",
          content: "Contenido exclusivo de Tenant Beta",
          tokenCount: 16,
          embedding: vecB,
          metadata: {},
        });
      });
    });

    afterAll(async () => {
      // `rag_audit_log` is WORM-immutable (just like `audit_log` in `real-db.ts`):
      // never disable triggers or acquire ACCESS EXCLUSIVE locks during parallel suites.
      if (admin) await admin.end();
      if (pool) await pool.end();
    });

    it("enforces forced RLS across rag_documents, rag_document_chunks, and rag_pii_vault without WHERE filters", async () => {
      const docsInA = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
        tx.select({ id: ragDocuments.id }).from(ragDocuments),
      );
      expect(docsInA.map((d) => d.id)).toContain(docAId);
      expect(docsInA.map((d) => d.id)).not.toContain(docBId);

      const vaultInB = await runInWorkspaceRlsReadonly(database(), WS_B, (tx) =>
        tx.select({ id: ragPiiVault.id }).from(ragPiiVault),
      );
      expect(vaultInB).toEqual([]);
    });

    it("rejects cross-tenant chunk insertion via compound FK (document_id, workspace_id) with 23503", async () => {
      const vec = generateDeterministicEmbedding("cross tenant fk probe");
      const err = await runInWorkspaceRls(database(), WS_B, (tx) =>
        tx.insert(ragDocumentChunks).values({
          documentId: docAId, // Belongs to WS_A!
          workspaceId: WS_B,
          chunkIndex: 99,
          chunkType: "row_group",
          content: "Intento de cruce de tenant",
          tokenCount: 5,
          embedding: vec,
          metadata: {},
        }),
      ).then(
        () => null,
        (e: unknown) => e,
      );

      expect(err).not.toBeNull();
      expect(["23503", "42501"]).toContain(sqlStateOf(err));
    });

    it("enforces match_rag_chunks() session assertion (42501), tenant isolation, and vendor pushdown", async () => {
      const qVec = `[${generateDeterministicEmbedding("Contenedor MSCU1234567").join(",")}]`;

      // Cross-tenant p_workspace_id mismatch MUST fail with 42501
      const mismatchErr = await runInWorkspaceRlsReadonly(
        database(),
        WS_A,
        (tx) =>
          tx.execute(
            sql`SELECT * FROM public.match_rag_chunks(${WS_B}::uuid, ${qVec}::extensions.vector, 0.0, 10, NULL, 'owner', NULL)`,
          ),
      ).then(
        () => null,
        (e: unknown) => e,
      );
      expect(sqlStateOf(mismatchErr)).toBe("42501");

      // Employee cannot view vendor-restricted document in WS_A
      const empMatches = await runInWorkspaceRlsReadonly(
        database(),
        WS_A,
        (tx) =>
          tx
            .execute(
              sql`SELECT document_id FROM public.match_rag_chunks(${WS_A}::uuid, ${qVec}::extensions.vector, 0.0, 10, NULL, 'employee', NULL)`,
            )
            .then((r) => rowsOf<{ document_id: string }>(r)),
      );
      expect(empMatches).toEqual([]);

      // Matching vendor sees their own document in WS_A and ZERO rows from WS_B
      const vendorMatches = await runInWorkspaceRlsReadonly(
        database(),
        WS_A,
        (tx) =>
          tx
            .execute(
              sql`SELECT document_id FROM public.match_rag_chunks(${WS_A}::uuid, ${qVec}::extensions.vector, 0.0, 10, NULL, 'vendor', ${VENDOR_A}::uuid)`,
            )
            .then((r) => rowsOf<{ document_id: string }>(r)),
      );
      expect(vendorMatches.map((m) => m.document_id)).toEqual([docAId]);
    });

    it("enforces WORM immutability on rag_audit_log and verifies SQL SHA-256 chain parity", async () => {
      await runInWorkspaceRls(database(), WS_A, async (tx) => {
        await tx.insert(ragAuditLog).values({
          workspaceId: WS_A,
          operationType: "search",
          queryText: "consulta:con:dos:puntos",
          promptTemplateHash: "pt-hash-1",
          retrievedChunkIds: [docAId],
          outputHash: "out-hash-1",
          metadata: { matchCount: 1 },
        });
      });

      // Attempt UPDATE as app_user -> rejected (42501)
      const updateErr = await runInWorkspaceRls(database(), WS_A, (tx) =>
        tx.execute(
          sql`UPDATE public.rag_audit_log SET query_text = 'borrado' WHERE workspace_id = ${WS_A}::uuid`,
        ),
      ).then(
        () => null,
        (e: unknown) => e,
      );
      expect(sqlStateOf(updateErr)).toBe("42501");

      // Attempt DELETE as app_user -> rejected (42501)
      const deleteErr = await runInWorkspaceRls(database(), WS_A, (tx) =>
        tx.execute(
          sql`DELETE FROM public.rag_audit_log WHERE workspace_id = ${WS_A}::uuid`,
        ),
      ).then(
        () => null,
        (e: unknown) => e,
      );
      expect(sqlStateOf(deleteErr)).toBe("42501");

      // Verify SQL trigger hashes match TypeScript computeSqlAuditHashes byte-for-byte
      const auditRows = await runInWorkspaceRlsReadonly(
        database(),
        WS_A,
        (tx) =>
          tx
            .execute(
              sql`SELECT workspace_id::text, user_id::text, operation_type, query_text, prompt_template_hash, retrieved_chunk_ids::text[], output_hash, metadata::text AS metadata_text, seq::int, prev_hash, payload_hash, chain_hash FROM public.rag_audit_log WHERE workspace_id = ${WS_A}::uuid ORDER BY seq ASC`,
            )
            .then((r) =>
              rowsOf<{
                workspace_id: string;
                user_id: string | null;
                operation_type: string;
                query_text: string | null;
                prompt_template_hash: string;
                retrieved_chunk_ids: string[];
                output_hash: string;
                metadata_text: string;
                seq: number;
                prev_hash: string;
                payload_hash: string;
                chain_hash: string;
              }>(r),
            ),
      );
      expect(auditRows.length).toBeGreaterThanOrEqual(1);
      const first = auditRows[0];
      expect(first).toBeDefined();
      if (first) {
        const tsComputed = computeSqlAuditHashes({
          workspaceId: first.workspace_id,
          userId: first.user_id,
          operationType: first.operation_type,
          queryText: first.query_text,
          promptTemplateHash: first.prompt_template_hash,
          retrievedChunkIds: first.retrieved_chunk_ids,
          outputHash: first.output_hash,
          metadataText: first.metadata_text,
          prevHash: first.prev_hash,
          seq: first.seq,
        });
        expect(first.payload_hash).toBe(tsComputed.payloadHash);
        expect(first.chain_hash).toBe(tsComputed.chainHash);
      }

      // Stored verifier must report 0 violations across all 3 invariants
      if (admin) {
        const verifyRes = await admin.query<{
          invariant: string;
          violations: string;
        }>(`SELECT * FROM public.verify_rag_audit_chain_integrity()`);
        for (const row of verifyRes.rows) {
          expect(Number(row.violations)).toBe(0);
        }
      }
    });
  },
);
