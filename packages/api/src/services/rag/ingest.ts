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
import {
  ragDocumentChunks,
  ragDocuments,
  ragPiiVault,
} from "@cendaro/db/schema";
import { isOwnedStorageUrl } from "@cendaro/validators";

import type { ChunkInvoiceInput, ChunkPackingListInput } from "./chunker";
import type { VaultRecord } from "./pii-vault";
import { runInWorkspaceRls } from "../../trpc";
import { logRagAuditEvent, sha256Hex } from "./audit";
import {
  chunkInvoice,
  chunkPackingList,
  chunkRawCommercialDocument,
  estimateTokenCount,
} from "./chunker";
import { generateEmbeddings } from "./embeddings";
import { sanitizeDocumentStructuralContent } from "./guardrails";
import {
  deriveWorkspaceKey,
  encryptPiiValue,
  tokenizeAndVaultContent,
} from "./pii-vault";

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
  sanitizedTitle?: string;
  sanitizedDocumentMeta?: DocumentMetadata;
  vaultEntries?: VaultRecord[];
}

// ──────────────────────────────────────────────
// Core Ingestion Orchestrator
// ──────────────────────────────────────────────

/**
 * Computes token counts and 1536-dim vector embeddings OUTSIDE any database
 * transaction so pooled Supavisor (:6543) connections are never held open
 * during external network I/O.
 *
 * Pre-Embedding Tokenization: Vaults sensitive PII and replaces entities
 * with surrogate tokens before generating vector embeddings.
 */
/**
 * Recursively tokenizes sensitive PII strings inside JSON metadata objects
 * before database persistence so `metadata` never leaks cleartext RIFs/IBANs/PANs (F-05).
 */
function vaultMetadataValue(
  value: unknown,
  workspaceId: string,
  vaultBucket: VaultRecord[],
): unknown {
  if (typeof value === "string") {
    const { sanitizedContent, vaultEntries } = tokenizeAndVaultContent(
      sanitizeDocumentStructuralContent(value),
      workspaceId,
      "pending",
    );
    if (vaultEntries.length > 0) {
      vaultBucket.push(...vaultEntries);
    }
    return sanitizedContent;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      vaultMetadataValue(item, workspaceId, vaultBucket),
    );
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        k === "allowedRoles" ||
        k === "allowed_roles" ||
        k === "accessRoles" ||
        k === "restrictedFields" ||
        k === "vendorId" ||
        k === "customerId"
      ) {
        out[k] = v;
      } else {
        out[k] = vaultMetadataValue(v, workspaceId, vaultBucket);
      }
    }
    return out;
  }
  return value;
}

export async function prepareIngestPayload(
  input: RagIngestInput,
  workspaceId: string,
): Promise<PreparedIngestPayload> {
  if (!workspaceId || workspaceId.trim().length === 0) {
    throw new Error(
      "workspaceId es obligatorio para tokenizar PII antes de generar embeddings (F-03)",
    );
  }

  const allVaultEntries: VaultRecord[] = [];
  const sanitizedChunks: (RagChunkInput & { rawContent: string })[] = [];

  for (const chunk of input.chunks) {
    // Phase 3 Structural Sanitization: NFKC + Plane 14 tag strip + zero-width strip + recursive tag scrub
    // Runs BEFORE PII detection so zero-width splitters (e.g. J\u200B-12345678-9) cannot evade vaulting
    const cleanChunkContent = sanitizeDocumentStructuralContent(chunk.content);

    const { sanitizedContent, vaultEntries } = tokenizeAndVaultContent(
      cleanChunkContent,
      workspaceId,
      "pending",
    );
    const sanitizedChunkMeta = vaultMetadataValue(
      chunk.metadata,
      workspaceId,
      allVaultEntries,
    ) as Record<string, unknown>;

    sanitizedChunks.push({
      ...chunk,
      content: sanitizedContent,
      metadata: sanitizedChunkMeta,
      rawContent: cleanChunkContent,
    });
    allVaultEntries.push(...vaultEntries);
  }

  // Strictly generate embeddings server-side on sanitized content (V-01, Feature 14)
  const texts = sanitizedChunks.map((c) => c.content);
  const computedVectors = await generateEmbeddings(texts);

  const preparedChunks: (RagChunkInput & {
    embedding: number[];
    tokenCount: number;
  })[] = [];
  let totalTokenCount = 0;

  for (let i = 0; i < sanitizedChunks.length; i++) {
    const chunk = sanitizedChunks[i];
    if (!chunk) continue;
    const content = chunk.content;
    const tokenCount = chunk.tokenCount ?? estimateTokenCount(content);
    totalTokenCount += tokenCount;
    const embedding = computedVectors[i] ?? [];

    preparedChunks.push({
      chunkIndex: chunk.chunkIndex ?? i,
      chunkType: chunk.chunkType,
      content,
      metadata: chunk.metadata,
      tokenCount,
      embedding,
    });
  }

  const sanitizedDocumentMeta = vaultMetadataValue(
    input.metadata,
    workspaceId,
    allVaultEntries,
  ) as DocumentMetadata;

  const metadata = input.metadata as DocumentMetadata | undefined;
  const rawDocNumber =
    input.documentNumber ??
    metadata?.documentNumbers?.documentNumber ??
    metadata?.documentNumbers?.invoiceNumber ??
    metadata?.documentNumbers?.containerNumber ??
    null;

  let documentNumber: string | null = null;
  if (rawDocNumber) {
    const cleanNum = sanitizeDocumentStructuralContent(rawDocNumber).trim();
    const { sanitizedContent: vaultedNum, vaultEntries: numVault } =
      tokenizeAndVaultContent(cleanNum, workspaceId, "pending");
    if (numVault.length > 0) {
      allVaultEntries.push(...numVault);
    }
    documentNumber = vaultedNum.slice(0, 64) || null;
  }

  const rawCleanTitle =
    sanitizeDocumentStructuralContent(input.title).trim() ||
    "Documento sin título";
  const { sanitizedContent: vaultedTitle, vaultEntries: titleVault } =
    tokenizeAndVaultContent(rawCleanTitle, workspaceId, "pending");
  if (titleVault.length > 0) {
    allVaultEntries.push(...titleVault);
  }
  const sanitizedTitle = vaultedTitle.slice(0, 256) || "Documento sin título";

  return {
    preparedChunks,
    totalTokenCount,
    documentNumber,
    sanitizedTitle,
    sanitizedDocumentMeta,
    vaultEntries: allVaultEntries,
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
      title:
        prepared.sanitizedTitle ??
        (sanitizeDocumentStructuralContent(input.title).trim() ||
          "Documento sin título"),
      fileUrl: input.fileUrl ?? null,
      fileName: input.fileName ?? null,
      status: "indexed",
      metadata: prepared.sanitizedDocumentMeta ?? input.metadata,
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

  // Persist PII vault records with AES-256-GCM encryption in rag_pii_vault (Feature 11)
  if (prepared.vaultEntries && prepared.vaultEntries.length > 0) {
    const workspaceKey = deriveWorkspaceKey(ctx.workspace.workspaceId);
    const seenTokens = new Set<string>();
    const uniqueEntries = prepared.vaultEntries.filter((entry) => {
      if (seenTokens.has(entry.surrogateToken)) return false;
      seenTokens.add(entry.surrogateToken);
      return true;
    });

    const vaultInserts = uniqueEntries.map((entry) => {
      if (
        entry.buffer &&
        entry.keyFingerprint &&
        entry.workspaceId === ctx.workspace.workspaceId
      ) {
        return {
          workspaceId: ctx.workspace.workspaceId,
          documentId: doc.id,
          surrogateToken: entry.surrogateToken,
          entityType: entry.entityType,
          encryptedValue: entry.buffer,
          keyFingerprint: entry.keyFingerprint,
        };
      }
      const enc = encryptPiiValue(entry.cleartextValue ?? "", workspaceKey);
      return {
        workspaceId: ctx.workspace.workspaceId,
        documentId: doc.id,
        surrogateToken: entry.surrogateToken,
        entityType: entry.entityType,
        encryptedValue: enc.buffer,
        keyFingerprint: enc.keyFingerprint,
      };
    });

    if (vaultInserts.length > 0) {
      await tx.insert(ragPiiVault).values(vaultInserts).onConflictDoNothing();
    }
  }

  // Phase 4: Record tamper-evident WORM audit log entry in the same workspace RLS transaction
  await logRagAuditEvent(tx, {
    workspaceId: ctx.workspace.workspaceId,
    userId: ctx.user?.id ?? null,
    operationType: "ingest",
    outputHash: sha256Hex(
      `${doc.id}:${prepared.preparedChunks.length}:${prepared.totalTokenCount}`,
    ),
    metadata: {
      documentId: doc.id,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      chunkCount: prepared.preparedChunks.length,
      vaultedEntityCount: prepared.vaultEntries?.length ?? 0,
    },
    tokenUsage: {
      prompt: prepared.totalTokenCount,
      completion: 0,
      total: prepared.totalTokenCount,
    },
  });

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
  // Validate storage origin containment (V-12)
  if (
    input.fileUrl &&
    !isOwnedStorageUrl(input.fileUrl, ctx.workspace.workspaceId)
  ) {
    throw new Error(
      "El archivo proporcionado no pertenece al almacenamiento de este workspace (V-12)",
    );
  }

  const prepared = await prepareIngestPayload(input, ctx.workspace.workspaceId);

  // Wrap ingestion database persistence in runInWorkspaceRls (V-02)
  return await runInWorkspaceRls(
    ctx.db as unknown as Parameters<typeof runInWorkspaceRls>[0],
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
