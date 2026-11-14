/**
 * Cendaro — Commercial Document Ingestion & Orchestration Service
 *
 * Orchestrates document chunking, 1536-dimensional vector embedding generation,
 * and database persistence into `ragDocuments` and `ragDocumentChunks`.
 *
 * Supports both pre-chunked ingestion (via `RagIngestInput`) and automated
 * structured/raw document ingestion with hierarchical structure-aware chunking.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  DocumentMetadata,
  RagChunkInput,
  RagDocumentType,
  RagIngestInput,
} from "@cendaro/validators";
import { ragDocumentChunks, ragDocuments } from "@cendaro/db/schema";

import type { ChunkInvoiceInput, ChunkPackingListInput } from "./chunker";
import {
  chunkInvoice,
  chunkPackingList,
  chunkRawCommercialDocument,
  estimateTokenCount,
} from "./chunker";
import { generateEmbeddings } from "./embeddings";

// ──────────────────────────────────────────────
// Context & Result Interfaces
// ──────────────────────────────────────────────

export interface RagIngestContext {
  db: NodePgDatabase<Record<string, unknown>>;
  workspace: {
    workspaceId: string;
  };
  user?: {
    id: string;
  };
}

export interface IngestDocumentResult {
  documentId: string;
  workspaceId: string;
  title: string;
  documentType: RagDocumentType;
  documentNumber: string | null;
  status: "indexed";
  chunkCount: number;
  totalTokens: number;
  metadata: DocumentMetadata;
}

export interface PreparedIngestPayload {
  preparedChunks: (RagChunkInput & {
    embedding: number[];
    tokenCount: number;
  })[];
  totalTokenCount: number;
  documentNumber: string | null;
}

// ──────────────────────────────────────────────
// Core Ingestion Orchestrator
// ──────────────────────────────────────────────

/**
 * Computes token counts and 1536-dim vector embeddings OUTSIDE any database
 * transaction so pooled Supavisor (:6543) connections are never held open
 * during external network I/O.
 */
export async function prepareIngestPayload(
  input: RagIngestInput,
): Promise<PreparedIngestPayload> {
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];

  for (let i = 0; i < input.chunks.length; i++) {
    const chunk = input.chunks[i];
    if (chunk && chunk.embedding?.length !== 1536) {
      missingIndices.push(i);
      missingTexts.push(chunk.content);
    }
  }

  const computedVectors =
    missingTexts.length > 0 ? await generateEmbeddings(missingTexts) : [];
  const computedByIndex = new Map<number, number[]>();
  for (let j = 0; j < missingIndices.length; j++) {
    const idx = missingIndices[j];
    const vec = computedVectors[j];
    if (idx !== undefined && vec) {
      computedByIndex.set(idx, vec);
    }
  }

  const preparedChunks: (RagChunkInput & {
    embedding: number[];
    tokenCount: number;
  })[] = [];
  let totalTokenCount = 0;

  let chunkIdx = 0;
  for (const chunk of input.chunks) {
    const content = chunk.content;
    const tokenCount = chunk.tokenCount ?? estimateTokenCount(content);
    totalTokenCount += tokenCount;

    const embedding =
      chunk.embedding?.length === 1536
        ? chunk.embedding
        : (computedByIndex.get(chunkIdx) ?? []);

    preparedChunks.push({
      chunkIndex: chunk.chunkIndex ?? chunkIdx,
      chunkType: chunk.chunkType,
      content,
      metadata: chunk.metadata,
      tokenCount,
      embedding,
    });
    chunkIdx++;
  }

  const documentNumber =
    input.documentNumber ??
    input.metadata.documentNumbers?.documentNumber ??
    input.metadata.documentNumbers?.invoiceNumber ??
    input.metadata.documentNumbers?.containerNumber ??
    null;

  return {
    preparedChunks,
    totalTokenCount,
    documentNumber,
  };
}

/**
 * Persists an already-embedded RAG payload on an active database transaction
 * (e.g. inside `runInWorkspaceRls`) without creating nested SAVEPOINTs.
 */
export async function persistPreparedIngest(
  tx: Pick<NodePgDatabase<Record<string, unknown>>, "insert">,
  ctx: Pick<RagIngestContext, "workspace" | "user">,
  input: RagIngestInput,
  prepared: PreparedIngestPayload,
): Promise<IngestDocumentResult> {
  const [doc] = await tx
    .insert(ragDocuments)
    .values({
      workspaceId: ctx.workspace.workspaceId,
      documentType: input.documentType,
      documentNumber: prepared.documentNumber,
      title: input.title,
      fileUrl: input.fileUrl ?? null,
      fileName: input.fileName ?? null,
      status: "indexed",
      metadata: input.metadata,
      tokenCount: prepared.totalTokenCount,
      chunkCount: prepared.preparedChunks.length,
      createdBy: ctx.user?.id ?? null,
    })
    .returning();

  if (!doc) {
    throw new Error("No se pudo crear el registro maestro de ragDocuments");
  }

  if (prepared.preparedChunks.length > 0) {
    const chunkInserts = prepared.preparedChunks.map((chunk) => ({
      documentId: doc.id,
      workspaceId: ctx.workspace.workspaceId,
      chunkIndex: chunk.chunkIndex ?? 0,
      chunkType: chunk.chunkType,
      content: chunk.content,
      metadata: chunk.metadata,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
    }));

    await tx.insert(ragDocumentChunks).values(chunkInserts);
  }

  return {
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    title: doc.title,
    documentType: doc.documentType,
    documentNumber: doc.documentNumber,
    status: "indexed",
    chunkCount: prepared.preparedChunks.length,
    totalTokens: prepared.totalTokenCount,
    metadata: (doc.metadata ?? {}) as DocumentMetadata,
  };
}

/**
 * Ingests a pre-chunked or prepared document into the RAG database.
 * Computes embeddings outside the transaction, then persists atomically.
 */
export async function ingestDocument(
  ctx: RagIngestContext,
  input: RagIngestInput,
): Promise<IngestDocumentResult> {
  const prepared = await prepareIngestPayload(input);
  return await ctx.db.transaction(async (tx) =>
    persistPreparedIngest(tx, ctx, input, prepared),
  );
}

// ──────────────────────────────────────────────
// High-Level Commercial Ingestion Helpers
// ──────────────────────────────────────────────

/**
 * Ingests a structured Packing List with hierarchical chunking and vector embedding.
 */
export async function ingestPackingList(
  ctx: RagIngestContext,
  params: {
    header: ChunkPackingListInput["header"];
    items: ChunkPackingListInput["items"];
    title?: string;
    fileUrl?: string;
    fileName?: string;
    vendorId?: string;
  },
): Promise<IngestDocumentResult> {
  const { metadata, chunks } = chunkPackingList({
    header: params.header,
    items: params.items,
    vendorId: params.vendorId,
  });

  const title =
    params.title ??
    `Packing List ${params.header.containerNumber ?? params.header.blNumber ?? "Contenedor"}`;

  return ingestDocument(ctx, {
    documentType: "packing_list",
    documentNumber: params.header.containerNumber ?? params.header.blNumber,
    title,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    metadata,
    chunks,
  });
}

/**
 * Ingests a structured Commercial or Fiscal Invoice with hierarchical chunking and vector embedding.
 */
export async function ingestInvoice(
  ctx: RagIngestContext,
  params: {
    header: ChunkInvoiceInput["header"];
    items: ChunkInvoiceInput["items"];
    totals: ChunkInvoiceInput["totals"];
    title?: string;
    fileUrl?: string;
    fileName?: string;
    customerId?: string;
    vendorId?: string;
  },
): Promise<IngestDocumentResult> {
  const { metadata, chunks } = chunkInvoice({
    header: params.header,
    items: params.items,
    totals: params.totals,
    customerId: params.customerId,
    vendorId: params.vendorId,
  });

  const isFiscal = params.header.documentType === "fiscal_invoice";
  const title =
    params.title ??
    `${isFiscal ? "Factura Fiscal" : "Factura"} ${params.header.invoiceNumber}`;

  return ingestDocument(ctx, {
    documentType: params.header.documentType,
    documentNumber: params.header.invoiceNumber,
    title,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    metadata,
    chunks,
  });
}

/**
 * Ingests raw text or document content with automatic entity extraction and hierarchical chunking.
 */
export async function ingestRawDocument(
  ctx: RagIngestContext,
  params: {
    rawText: string;
    documentType: RagDocumentType;
    documentNumber?: string;
    title?: string;
    fileUrl?: string;
    fileName?: string;
    vendorId?: string;
  },
): Promise<IngestDocumentResult> {
  const { metadata, chunks } = chunkRawCommercialDocument(params.rawText, {
    documentType: params.documentType,
    documentNumber: params.documentNumber,
    title: params.title,
    vendorId: params.vendorId,
  });

  const title =
    params.title ??
    `${params.documentType.toUpperCase()} ${params.documentNumber ?? "Comercial"}`;

  return ingestDocument(ctx, {
    documentType: params.documentType,
    documentNumber:
      params.documentNumber ?? metadata.documentNumbers?.documentNumber,
    title,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    metadata,
    chunks,
  });
}
