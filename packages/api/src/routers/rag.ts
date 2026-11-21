/**
 * Cendaro — RAG tRPC Router
 *
 * Provides endpoints for commercial document search, ingestion, and retrieval.
 * All procedures are declared using authorization builders (`wsPermissionProcedure`,
 * `wsReadPermissionProcedure`) to enforce role-based access control and record `meta.authz`.
 */

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { ragDocumentChunks, ragDocuments } from "@cendaro/db/schema";
import {
  isOwnedStorageUrl,
  ragDocumentTypeSchema,
  ragIngestInputSchema,
  ragSearchInputSchema,
} from "@cendaro/validators";

import {
  buildRagDocRoleSqlFilter,
  buildRagDocVendorSqlFilter,
  FINANCIAL_CONTENT_REGEX,
  isRoleAllowed,
  isVendorAllowed,
  logRagAuditEvent,
  MANAGEMENT_ROLES,
  persistPreparedIngest,
  prepareIngestPayload,
  RagGuardrailViolationError,
  redactConfidentialContent,
  rehydrateChunksBatch,
  rehydrateMetadataBatch,
  sanitizeDocumentStructuralContent,
  sanitizeMetadata,
  scanOutputDLP,
  searchRagChunks,
  sha256Hex,
} from "../services/rag";
import {
  assertMfaCompliance,
  createTRPCRouter,
  runInWorkspaceRls,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";

export const ragRouter = createTRPCRouter({
  /**
   * Semantic vector similarity search across commercial document chunks.
   * Gated by orders:read permission; applies RLS and role-based field redactions.
   */
  search: wsReadPermissionProcedure("orders", "read")
    .input(ragSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const startedAt = Date.now();
      try {
        const res = await searchRagChunks(ctx, input);
        const latencyMs = Date.now() - startedAt;
        const retrievedChunkIds = res.results.map((r) => r.chunkId);
        const outputHash = sha256Hex(retrievedChunkIds.join(","));

        ctx.afterCommit.push(async (poolDb) => {
          const canPersist =
            typeof (poolDb as unknown as { transaction?: unknown })
              .transaction === "function" &&
            typeof (poolDb as unknown as { insert?: unknown }).insert ===
              "function";
          if (canPersist) {
            await runInWorkspaceRls(poolDb, ctx.workspace.workspaceId, (tx) =>
              logRagAuditEvent(
                tx as unknown as Parameters<typeof logRagAuditEvent>[0],
                {
                  workspaceId: ctx.workspace.workspaceId,
                  userId: ctx.user.id,
                  operationType: "search",
                  queryText: input.query,
                  retrievedChunkIds,
                  outputHash,
                  latencyMs,
                  metadata: {
                    role: ctx.workspace.role,
                    documentType: input.documentType ?? null,
                    matchCount: res.totalMatches,
                  },
                },
              ),
            );
          } else {
            await logRagAuditEvent(undefined, {
              workspaceId: ctx.workspace.workspaceId,
              userId: ctx.user.id,
              operationType: "search",
              queryText: input.query,
              retrievedChunkIds,
              outputHash,
              latencyMs,
              metadata: {
                role: ctx.workspace.role,
                documentType: input.documentType ?? null,
                matchCount: res.totalMatches,
              },
            });
          }
        });

        return res;
      } catch (err) {
        if (err instanceof RagGuardrailViolationError) {
          const latencyMs = Date.now() - startedAt;
          ctx.afterCommit.push(async (poolDb) => {
            const canPersist =
              typeof (poolDb as unknown as { transaction?: unknown })
                .transaction === "function" &&
              typeof (poolDb as unknown as { insert?: unknown }).insert ===
                "function";
            if (canPersist) {
              await runInWorkspaceRls(poolDb, ctx.workspace.workspaceId, (tx) =>
                logRagAuditEvent(
                  tx as unknown as Parameters<typeof logRagAuditEvent>[0],
                  {
                    workspaceId: ctx.workspace.workspaceId,
                    userId: ctx.user.id,
                    operationType: "guardrail_violation",
                    queryText: input.query,
                    latencyMs,
                    metadata: {
                      role: ctx.workspace.role,
                      reason: err.reason,
                      score: err.score,
                    },
                  },
                ),
              );
            } else {
              await logRagAuditEvent(undefined, {
                workspaceId: ctx.workspace.workspaceId,
                userId: ctx.user.id,
                operationType: "guardrail_violation",
                queryText: input.query,
                latencyMs,
                metadata: {
                  role: ctx.workspace.role,
                  reason: err.reason,
                  score: err.score,
                },
              });
            }
          });

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }
        throw err;
      }
    }),

  /**
   * Ingest a commercial document (packing list, commercial/fiscal invoice).
   * Gated by containers:update permission + MFA compliance for privileged roles.
   * Built on `wsReadPermissionProcedure` (same pattern as `pricing.syncRates`)
   * so slow external embedding calls finish BEFORE opening the short
   * `runInWorkspaceRls` write transaction on Supavisor (:6543).
   */
  ingestDocument: wsReadPermissionProcedure("containers", "update")
    .input(ragIngestInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertMfaCompliance(ctx.user);
      if (
        input.fileUrl &&
        !isOwnedStorageUrl(input.fileUrl, ctx.workspace.workspaceId)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "fileUrl no pertenece al almacenamiento de este workspace (V-12)",
        });
      }
      const prepared = await prepareIngestPayload(
        input,
        ctx.workspace.workspaceId,
      );
      return runInWorkspaceRls(
        ctx.db,
        ctx.workspace.workspaceId,
        (tx) =>
          persistPreparedIngest(
            tx as unknown as Parameters<typeof persistPreparedIngest>[0],
            ctx,
            input,
            prepared,
          ),
        { statementTimeoutMs: 15_000 },
      );
    }),

  /**
   * Retrieves full details and chunks of a single commercial document.
   * Gated by orders:read permission.
   */
  getDocument: wsReadPermissionProcedure("orders", "read")
    .input(
      z.object({
        id: z.string().uuid("ID de documento inválido"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startedAt = Date.now();
      const [doc] = await ctx.db
        .select()
        .from(ragDocuments)
        .where(
          and(
            eq(ragDocuments.id, input.id),
            eq(ragDocuments.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento RAG no encontrado",
        });
      }

      const docMeta = (doc.metadata ?? {}) as Record<string, unknown>;
      const userVendorId =
        (ctx.user as { id: string; vendorId?: string }).vendorId ??
        (ctx.workspace.role === "vendor" ? ctx.user.id : undefined);

      // Check role-based document access clearance
      if (!isRoleAllowed(ctx.workspace.role, {}, docMeta)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No autorizado para acceder a este documento",
        });
      }

      // Check vendor isolation
      if (
        !isVendorAllowed(
          ctx.workspace.role,
          userVendorId,
          undefined,
          {},
          docMeta,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Acceso denegado: no autorizado para ver documentos de este proveedor",
        });
      }

      const chunks = await ctx.db
        .select({
          id: ragDocumentChunks.id,
          chunkIndex: ragDocumentChunks.chunkIndex,
          chunkType: ragDocumentChunks.chunkType,
          content: ragDocumentChunks.content,
          tokenCount: ragDocumentChunks.tokenCount,
          metadata: ragDocumentChunks.metadata,
          createdAt: ragDocumentChunks.createdAt,
        })
        .from(ragDocumentChunks)
        .where(
          and(
            eq(ragDocumentChunks.documentId, input.id),
            eq(ragDocumentChunks.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .orderBy(asc(ragDocumentChunks.chunkIndex));

      // Server-side confidential classification & role-gated redaction (V-10, F-02, F-05)
      const isManagement = MANAGEMENT_ROLES.has(ctx.workspace.role);
      const isConfidential =
        doc.documentType === "commercial_invoice" ||
        doc.documentType === "fiscal_invoice" ||
        docMeta.confidentialCosts === true ||
        (
          docMeta.queryRestrictions as
            { confidentialCosts?: boolean } | undefined
        )?.confidentialCosts === true ||
        (docMeta.totals as { totalAmount?: number } | undefined)
          ?.totalAmount !== undefined;

      const visibleChunks = chunks.filter((chunk) => {
        const chunkMeta = (chunk.metadata ?? {}) as Record<string, unknown>;
        return (
          isRoleAllowed(ctx.workspace.role, chunkMeta, docMeta) &&
          isVendorAllowed(
            ctx.workspace.role,
            userVendorId,
            undefined,
            chunkMeta,
            docMeta,
          )
        );
      });

      const rehydratedContents = await rehydrateChunksBatch(
        visibleChunks.map((chunk) => ({
          documentId: doc.id,
          content: chunk.content,
        })),
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      const rehydratedMetas = await rehydrateMetadataBatch(
        [
          { documentId: doc.id, metadata: docMeta },
          ...visibleChunks.map((chunk) => ({
            documentId: doc.id,
            metadata: (chunk.metadata ?? {}) as Record<string, unknown>,
          })),
        ],
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      const [rehydratedTitle] = await rehydrateChunksBatch(
        [{ documentId: doc.id, content: doc.title || "" }],
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      const [rehydratedDocNum] = doc.documentNumber
        ? await rehydrateChunksBatch(
            [{ documentId: doc.id, content: doc.documentNumber }],
            ctx.workspace.workspaceId,
            ctx.workspace.role,
            ctx.db,
          )
        : [null];

      const rehydratedDocMeta = rehydratedMetas[0] ?? docMeta;

      const sanitizedChunks = visibleChunks.map((chunk, idx) => {
        const chunkMeta = (chunk.metadata ?? {}) as Record<string, unknown>;
        const rehydratedChunkMeta = rehydratedMetas[idx + 1] ?? chunkMeta;
        const rehydratedContent = rehydratedContents[idx] ?? chunk.content;
        const hasFobInChunk = FINANCIAL_CONTENT_REGEX.test(rehydratedContent);
        const chunkIsConfidential =
          isConfidential ||
          chunkMeta.confidentialCosts === true ||
          hasFobInChunk;
        if (!isManagement) {
          const textOut = chunkIsConfidential
            ? redactConfidentialContent(rehydratedContent)
            : rehydratedContent;
          return {
            ...chunk,
            content: scanOutputDLP(textOut).sanitized,
            metadata: sanitizeMetadata(rehydratedChunkMeta),
          };
        }
        return {
          ...chunk,
          content: scanOutputDLP(rehydratedContent).sanitized,
          metadata: rehydratedChunkMeta,
        };
      });

      const rawCleanDocTitle = sanitizeDocumentStructuralContent(
        rehydratedTitle ?? doc.title,
      ).trim();
      const titleForCaller =
        !isManagement && isConfidential
          ? redactConfidentialContent(rawCleanDocTitle)
          : rawCleanDocTitle;

      const cleanDoc = {
        ...doc,
        documentNumber:
          doc.documentNumber !== null && rehydratedDocNum !== null
            ? scanOutputDLP(rehydratedDocNum).sanitized || doc.documentNumber
            : doc.documentNumber,
        title:
          scanOutputDLP(titleForCaller).sanitized || "Documento sin título",
        metadata: rehydratedDocMeta,
      };

      const finalDoc = !isManagement
        ? {
            ...cleanDoc,
            metadata: sanitizeMetadata(rehydratedDocMeta),
          }
        : cleanDoc;

      const latencyMs = Date.now() - startedAt;
      const retrievedChunkIds = sanitizedChunks.map((c) => c.id);
      const outputHash = sha256Hex(`${doc.id}:${retrievedChunkIds.join(",")}`);

      ctx.afterCommit.push(async (poolDb) => {
        const canPersist =
          typeof (poolDb as unknown as { transaction?: unknown })
            .transaction === "function" &&
          typeof (poolDb as unknown as { insert?: unknown }).insert ===
            "function";
        if (canPersist) {
          await runInWorkspaceRls(poolDb, ctx.workspace.workspaceId, (tx) =>
            logRagAuditEvent(
              tx as unknown as Parameters<typeof logRagAuditEvent>[0],
              {
                workspaceId: ctx.workspace.workspaceId,
                userId: ctx.user.id,
                operationType: "search",
                retrievedChunkIds,
                outputHash,
                latencyMs,
                metadata: {
                  action: "getDocument",
                  documentId: doc.id,
                  documentType: doc.documentType,
                  role: ctx.workspace.role,
                  chunkCount: sanitizedChunks.length,
                },
              },
            ),
          );
        } else {
          await logRagAuditEvent(undefined, {
            workspaceId: ctx.workspace.workspaceId,
            userId: ctx.user.id,
            operationType: "search",
            retrievedChunkIds,
            outputHash,
            latencyMs,
            metadata: {
              action: "getDocument",
              documentId: doc.id,
              documentType: doc.documentType,
              role: ctx.workspace.role,
              chunkCount: sanitizedChunks.length,
            },
          });
        }
      });

      return {
        document: finalDoc,
        chunks: sanitizedChunks,
      };
    }),

  /**
   * Lists commercial documents in the active workspace.
   * Gated by orders:read permission; pushes SQL RBAC + vendor filters before LIMIT.
   */
  listDocuments: wsReadPermissionProcedure("orders", "read")
    .input(
      z.object({
        documentType: ragDocumentTypeSchema.optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const isManagement = MANAGEMENT_ROLES.has(ctx.workspace.role);
      const userVendorId =
        (ctx.user as { id: string; vendorId?: string }).vendorId ??
        (ctx.workspace.role === "vendor" ? ctx.user.id : undefined);

      const docs = await ctx.db
        .select()
        .from(ragDocuments)
        .where(
          and(
            eq(ragDocuments.workspaceId, ctx.workspace.workspaceId),
            input.documentType
              ? eq(ragDocuments.documentType, input.documentType)
              : undefined,
            buildRagDocRoleSqlFilter(ctx.workspace.role),
            buildRagDocVendorSqlFilter(ctx.workspace.role, userVendorId),
          ),
        )
        .orderBy(desc(ragDocuments.createdAt))
        .limit(Math.max(input.limit * 3, 50));

      const authorizedDocs: (typeof docs)[number][] = [];
      for (const doc of docs) {
        const docMeta = (doc.metadata ?? {}) as Record<string, unknown>;
        if (!isRoleAllowed(ctx.workspace.role, {}, docMeta)) {
          continue;
        }
        if (
          !isVendorAllowed(
            ctx.workspace.role,
            userVendorId,
            undefined,
            {},
            docMeta,
          )
        ) {
          continue;
        }
        authorizedDocs.push(doc);
        if (authorizedDocs.length >= input.limit) {
          break;
        }
      }

      const rehydratedDocMetas = await rehydrateMetadataBatch(
        authorizedDocs.map((doc) => ({
          documentId: doc.id,
          metadata: (doc.metadata ?? {}) as Record<string, unknown>,
        })),
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      const rehydratedDocTitles = await rehydrateChunksBatch(
        authorizedDocs.map((doc) => ({
          documentId: doc.id,
          content: doc.title || "",
        })),
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      const rehydratedDocNumbers = await rehydrateChunksBatch(
        authorizedDocs.map((doc) => ({
          documentId: doc.id,
          content: doc.documentNumber ?? "",
        })),
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        ctx.db,
      );

      return authorizedDocs.map((doc, idx) => {
        const docMeta = (doc.metadata ?? {}) as Record<string, unknown>;
        const rehydratedMeta = rehydratedDocMetas[idx] ?? docMeta;
        const rehydratedNum = rehydratedDocNumbers[idx] ?? "";
        const rawDocTitle = sanitizeDocumentStructuralContent(
          rehydratedDocTitles[idx] ?? doc.title,
        ).trim();
        const docIsConfidential =
          doc.documentType === "commercial_invoice" ||
          doc.documentType === "fiscal_invoice" ||
          docMeta.confidentialCosts === true ||
          FINANCIAL_CONTENT_REGEX.test(rawDocTitle);
        const safeTitle =
          scanOutputDLP(
            !isManagement && docIsConfidential
              ? redactConfidentialContent(rawDocTitle)
              : rawDocTitle,
          ).sanitized || "Documento sin título";
        const safeDocNumber =
          doc.documentNumber !== null
            ? scanOutputDLP(rehydratedNum).sanitized || doc.documentNumber
            : null;
        return !isManagement
          ? {
              ...doc,
              documentNumber: safeDocNumber,
              title: safeTitle,
              metadata: sanitizeMetadata(rehydratedMeta),
            }
          : {
              ...doc,
              documentNumber: safeDocNumber,
              title: safeTitle,
              metadata: rehydratedMeta,
            };
      });
    }),

  /**
   * GDPR Art. 17 Crypto-Shredding & Erasure: deletes a workspace RAG document,
   * cascading its chunks (`rag_document_chunks`) and encrypted vault tokens
   * (`rag_pii_vault`) via composite `(document_id, workspace_id)` foreign keys,
   * and records an immutable WORM entry in `rag_audit_log`.
   */
  deleteDocument: wsPermissionProcedure("containers", "delete")
    .input(
      z.object({
        id: z.string().uuid("ID de documento inválido"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertMfaCompliance(ctx.user);

      const [deleted] = await ctx.db
        .delete(ragDocuments)
        .where(
          and(
            eq(ragDocuments.id, input.id),
            eq(ragDocuments.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning({
          id: ragDocuments.id,
          documentType: ragDocuments.documentType,
          documentNumber: ragDocuments.documentNumber,
        });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento RAG no encontrado en este workspace",
        });
      }

      await logRagAuditEvent(ctx.db, {
        workspaceId: ctx.workspace.workspaceId,
        userId: ctx.user.id,
        operationType: "delete",
        outputHash: sha256Hex(`deleted:${deleted.id}`),
        metadata: {
          documentId: deleted.id,
          documentType: deleted.documentType,
          documentNumber: deleted.documentNumber,
        },
      });

      return { deletedId: deleted.id };
    }),
});
