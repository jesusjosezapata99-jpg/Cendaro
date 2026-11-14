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
  ragDocumentTypeSchema,
  ragIngestInputSchema,
  ragSearchInputSchema,
} from "@cendaro/validators";

import {
  isRoleAllowed,
  isVendorAllowed,
  persistPreparedIngest,
  prepareIngestPayload,
  redactConfidentialContent,
  sanitizeMetadata,
  searchRagChunks,
} from "../services/rag";
import {
  assertMfaCompliance,
  createTRPCRouter,
  runInWorkspaceRls,
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
      return searchRagChunks(ctx, input);
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
      const prepared = await prepareIngestPayload(input);
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

      // Redact confidential costs for non-management roles if flagged
      const isManagement = ["owner", "admin", "supervisor"].includes(
        ctx.workspace.role,
      );
      const isConfidential =
        docMeta.confidentialCosts === true ||
        (
          docMeta.queryRestrictions as
            { confidentialCosts?: boolean } | undefined
        )?.confidentialCosts === true;

      const sanitizedChunks = chunks
        .filter((chunk) => {
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
        })
        .map((chunk) => {
          const chunkMeta = (chunk.metadata ?? {}) as Record<string, unknown>;
          const chunkIsConfidential =
            isConfidential || chunkMeta.confidentialCosts === true;
          if (!isManagement && chunkIsConfidential) {
            const redactedContent = redactConfidentialContent(chunk.content);
            const meta = sanitizeMetadata(chunkMeta);
            return {
              ...chunk,
              content: redactedContent,
              metadata: meta,
            };
          }
          return chunk;
        });

      const finalDoc = !isManagement
        ? {
            ...doc,
            metadata: sanitizeMetadata(docMeta),
          }
        : doc;

      return {
        document: finalDoc,
        chunks: sanitizedChunks,
      };
    }),

  /**
   * Lists commercial documents in the active workspace.
   * Gated by orders:read permission.
   */
  listDocuments: wsReadPermissionProcedure("orders", "read")
    .input(
      z.object({
        documentType: ragDocumentTypeSchema.optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const isManagement = ["owner", "admin", "supervisor"].includes(
        ctx.workspace.role,
      );
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
          ),
        )
        .orderBy(desc(ragDocuments.createdAt))
        .limit(Math.max(input.limit * 3, 50));

      const filteredDocs = [];
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

        const sanitizedDoc = !isManagement
          ? { ...doc, metadata: sanitizeMetadata(docMeta) }
          : doc;

        filteredDocs.push(sanitizedDoc);
        if (filteredDocs.length >= input.limit) {
          break;
        }
      }

      return filteredDocs;
    }),
});
