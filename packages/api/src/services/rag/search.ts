/**
 * Cendaro — RAG Vector Similarity Search Service
 *
 * Implements vector semantic search querying `ragDocumentChunks` using Drizzle ORM's
 * `cosineDistance(ragDocumentChunks.embedding, queryEmbedding)` and `asc()`.
 *
 * Guarantees:
 *   • Multi-tenant isolation by filtering `workspace_id = ctx.workspace.workspaceId`.
 *   • Role-based access control via `allowedRoles` metadata inspection.
 *   • Confidential cost redaction (FOB prices, purchase costs, margins) for sales floor,
 *     vendor, and marketing roles.
 *   • Vendor-scoped query isolation.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, eq, sql } from "drizzle-orm";

import type {
  RagAccessRole,
  RagDocumentType,
  RagSearchInput,
} from "@cendaro/validators";
import { ragDocumentChunks, ragDocuments } from "@cendaro/db/schema";

import { generateEmbedding } from "./embeddings";

// ──────────────────────────────────────────────
// Types & Context Interfaces
// ──────────────────────────────────────────────

export interface RagSearchContext {
  db: NodePgDatabase<Record<string, unknown>>;
  workspace: {
    workspaceId: string;
    role: RagAccessRole;
  };
  user: {
    id: string;
    vendorId?: string;
  };
}

export interface RagSearchResultItem {
  chunkId: string;
  documentId: string;
  documentType: RagDocumentType;
  documentNumber: string | null;
  title: string;
  chunkIndex: number;
  chunkType: string;
  content: string;
  similarity: number;
  distance: number;
  tokenCount: number | null;
  metadata: Record<string, unknown>;
}

export interface RagSearchResponse {
  results: RagSearchResultItem[];
  totalMatches: number;
  query: string;
}

// ──────────────────────────────────────────────
// Redaction & Access Control Utilities
// ──────────────────────────────────────────────

export const MANAGEMENT_ROLES: ReadonlySet<RagAccessRole> = new Set([
  "owner",
  "admin",
  "supervisor",
]);

/**
 * Checks if a user's role is permitted by the document/chunk access rules.
 */
export function isRoleAllowed(
  userRole: RagAccessRole,
  chunkMeta: Record<string, unknown>,
  docMeta: Record<string, unknown>,
): boolean {
  // Check chunk-level allowed roles first, then document-level
  const allowed =
    (chunkMeta.accessRoles as RagAccessRole[] | undefined) ??
    (chunkMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
      ?.allowedRoles ??
    (docMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
      ?.allowedRoles ??
    (docMeta.accessRoles as RagAccessRole[] | undefined);

  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.includes(userRole);
  }

  // Default: accessible if no explicit restrictions are declared
  return true;
}

/**
 * Checks vendor scoping rules: vendors can only access chunks matching their vendor ID
 * if vendor restrictions are declared. Non-management users cannot view vendor-restricted documents.
 */
export function isVendorAllowed(
  userRole: RagAccessRole,
  userVendorId: string | undefined,
  targetVendorId: string | undefined,
  chunkMeta: Record<string, unknown>,
  docMeta: Record<string, unknown>,
): boolean {
  const restrictedVendorId =
    (chunkMeta.vendorId as string | undefined) ??
    (chunkMeta.queryRestrictions as { vendorId?: string } | undefined)
      ?.vendorId ??
    (docMeta.queryRestrictions as { vendorId?: string } | undefined)?.vendorId;

  // Case 1: Caller is a vendor (external / commissioned representative)
  if (userRole === "vendor") {
    // A vendor can NEVER specify or target another vendor's ID
    if (targetVendorId && targetVendorId !== userVendorId) {
      return false;
    }
    // If the chunk/doc is vendor-restricted, it MUST match the caller's authenticated vendorId
    if (restrictedVendorId) {
      return Boolean(userVendorId) && restrictedVendorId === userVendorId;
    }
    // Fail closed on unassigned internal workspace documents unless "vendor"
    // is explicitly listed in the chunk or document access rules.
    const explicitAllowed =
      (chunkMeta.accessRoles as RagAccessRole[] | undefined) ??
      (chunkMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
        ?.allowedRoles ??
      (docMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
        ?.allowedRoles ??
      (docMeta.accessRoles as RagAccessRole[] | undefined);
    return Array.isArray(explicitAllowed) && explicitAllowed.includes("vendor");
  }

  // Case 2: Document/chunk is restricted to a vendor
  if (restrictedVendorId) {
    // Non-management callers cannot view vendor-restricted documents
    if (!MANAGEMENT_ROLES.has(userRole)) {
      return false;
    }
    // If management specified a target vendor filter, it must match
    if (targetVendorId && targetVendorId !== restrictedVendorId) {
      return false;
    }
    return true;
  }

  // Case 3: Document/chunk has NO vendor restriction, but caller filtered by targetVendorId
  if (targetVendorId) {
    return false;
  }

  return true;
}

/**
 * Redacts confidential FOB and purchase costs from chunk text for sales floor,
 * vendor, and marketing personnel.
 */
export function redactConfidentialContent(content: string): string {
  return content
    .replace(
      /(?:P\.Unit\s*FOB|Precio\s*FOB|Unit\s*Cost\s*FOB)[\s:]+\$[0-9.,]+/gi,
      "P.Unit FOB: [CONFIDENCIAL]",
    )
    .replace(
      /(?:Total\s*FOB|Costo\s*Total\s*FOB)[\s:]+\$[0-9.,]+/gi,
      "Total FOB: [CONFIDENCIAL]",
    )
    .replace(
      /(?:Valor\s*Total\s*FOB[^\n:]*)[\s:]+\$[0-9.,]+(?:\s*USD)?/gi,
      "Valor Total FOB: [CONFIDENCIAL]",
    )
    .replace(/(?:Costo\s*FOB)[\s:]+\$[0-9.,]+/gi, "Costo FOB: [CONFIDENCIAL]");
}

/**
 * Strips confidential financial keys from chunk and document metadata.
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...metadata };
  delete sanitized.unitCostFob;
  delete sanitized.totalCostFob;
  delete sanitized.costFob;
  delete sanitized.purchasePrice;
  delete sanitized.fobCost;
  delete sanitized.totalAmount;
  if (sanitized.totals && typeof sanitized.totals === "object") {
    const sanitizedTotals = {
      ...(sanitized.totals as Record<string, unknown>),
    };
    delete sanitizedTotals.totalAmount;
    delete sanitizedTotals.subtotal;
    delete sanitizedTotals.tax;
    sanitized.totals = sanitizedTotals;
  }
  if (
    sanitized.documentMetadata &&
    typeof sanitized.documentMetadata === "object"
  ) {
    sanitized.documentMetadata = sanitizeMetadata(
      sanitized.documentMetadata as Record<string, unknown>,
    );
  }
  return sanitized;
}

// ──────────────────────────────────────────────
// Vector Search Implementation
// ──────────────────────────────────────────────

/**
 * Executes a semantic vector similarity search using Drizzle ORM pgvector cosineDistance.
 */
export async function searchRagChunks(
  ctx: RagSearchContext,
  input: RagSearchInput,
): Promise<RagSearchResponse> {
  const userRole = ctx.workspace.role;
  const isManagement = MANAGEMENT_ROLES.has(userRole);
  const userVendorId =
    ctx.user.vendorId ?? (userRole === "vendor" ? ctx.user.id : undefined);

  // 1. Generate 1536-dimensional query embedding
  const queryEmbedding = await generateEmbedding(input.query);

  // 2. Build schema-qualified pgvector cosine distance expression (`extensions.<=>`)
  //    so HNSW index scans work regardless of connection `search_path`.
  const vectorLiteral = `[${queryEmbedding.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
  const distanceExpr = sql<number>`(${ragDocumentChunks.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector)`;

  // 3. Query pgvector chunks with tenant isolation and document type filter
  const rows = await ctx.db
    .select({
      chunkId: ragDocumentChunks.id,
      documentId: ragDocumentChunks.documentId,
      chunkIndex: ragDocumentChunks.chunkIndex,
      chunkType: ragDocumentChunks.chunkType,
      content: ragDocumentChunks.content,
      tokenCount: ragDocumentChunks.tokenCount,
      chunkMetadata: ragDocumentChunks.metadata,
      documentType: ragDocuments.documentType,
      documentNumber: ragDocuments.documentNumber,
      documentTitle: ragDocuments.title,
      documentMetadata: ragDocuments.metadata,
      distance: distanceExpr,
    })
    .from(ragDocumentChunks)
    .innerJoin(ragDocuments, eq(ragDocumentChunks.documentId, ragDocuments.id))
    .where(
      and(
        eq(ragDocumentChunks.workspaceId, ctx.workspace.workspaceId),
        input.documentType
          ? eq(ragDocuments.documentType, input.documentType)
          : undefined,
      ),
    )
    .orderBy(asc(distanceExpr))
    .limit(Math.min(100, Math.max(input.limit * 3, 20))); // Oversample for post-query authorization filtering

  // 4. Post-query filtering: similarity threshold, RBAC, and redaction
  const matchingResults: RagSearchResultItem[] = [];

  for (const row of rows) {
    const rawDist = Number(row.distance);
    const distance = Number.isNaN(rawDist) ? 1.0 : rawDist;
    const similarity = Math.max(0.0, Math.min(1.0, 1.0 - distance));

    // Minimum similarity score threshold
    if (similarity < input.minScore) {
      continue;
    }

    const chunkMeta = (row.chunkMetadata ?? {}) as Record<string, unknown>;
    const docMeta = (row.documentMetadata ?? {}) as Record<string, unknown>;

    // Role-based access validation
    if (!isRoleAllowed(userRole, chunkMeta, docMeta)) {
      continue;
    }

    // Vendor query isolation
    if (
      !isVendorAllowed(
        userRole,
        userVendorId,
        input.vendorId,
        chunkMeta,
        docMeta,
      )
    ) {
      continue;
    }

    // Confidential cost redaction for non-management roles
    let finalContent = row.content;
    let finalMetadata: Record<string, unknown> = {
      ...chunkMeta,
      documentMetadata: docMeta,
    };

    const isConfidential =
      chunkMeta.confidentialCosts === true ||
      docMeta.confidentialCosts === true ||
      (docMeta.queryRestrictions as { confidentialCosts?: boolean } | undefined)
        ?.confidentialCosts === true;

    if (!isManagement && isConfidential) {
      finalContent = redactConfidentialContent(row.content);
      finalMetadata = sanitizeMetadata(finalMetadata);
    }

    matchingResults.push({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      title: row.documentTitle,
      chunkIndex: row.chunkIndex,
      chunkType: row.chunkType,
      content: finalContent,
      similarity: Number(similarity.toFixed(4)),
      distance: Number(distance.toFixed(4)),
      tokenCount: row.tokenCount,
      metadata: finalMetadata,
    });

    if (matchingResults.length >= input.limit) {
      break;
    }
  }

  return {
    results: matchingResults,
    totalMatches: matchingResults.length,
    query: input.query,
  };
}
