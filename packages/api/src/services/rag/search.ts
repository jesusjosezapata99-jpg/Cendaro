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

import type { SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, eq, sql } from "drizzle-orm";

import type {
  RagAccessRole,
  RagDocumentType,
  RagSearchInput,
} from "@cendaro/validators";
import { ragDocumentChunks, ragDocuments } from "@cendaro/db/schema";

import { generateEmbedding } from "./embeddings";
import {
  evaluateInputGuardrails,
  RagGuardrailViolationError,
  sanitizeDocumentStructuralContent,
  scanOutputDLP,
} from "./guardrails";
import { rehydrateChunksBatch, rehydrateMetadataBatch } from "./pii-vault";

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
  if (userRole === "owner") {
    return true;
  }

  // Check chunk-level allowed roles first, then document-level
  const allowed =
    (chunkMeta.allowed_roles as RagAccessRole[] | undefined) ??
    (chunkMeta.accessRoles as RagAccessRole[] | undefined) ??
    (chunkMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
      ?.allowedRoles ??
    (docMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
      ?.allowedRoles ??
    (docMeta.accessRoles as RagAccessRole[] | undefined) ??
    (docMeta.allowed_roles as RagAccessRole[] | undefined);

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
    (docMeta.vendorId as string | undefined) ??
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
      (chunkMeta.allowed_roles as RagAccessRole[] | undefined) ??
      (chunkMeta.accessRoles as RagAccessRole[] | undefined) ??
      (chunkMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
        ?.allowedRoles ??
      (docMeta.accessRules as { allowedRoles?: RagAccessRole[] } | undefined)
        ?.allowedRoles ??
      (docMeta.accessRoles as RagAccessRole[] | undefined) ??
      (docMeta.allowed_roles as RagAccessRole[] | undefined);
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
 * Server-side detector for confidential commercial cost / margin expressions across
 * Incoterms (FOB, CIF, CFR, EXW, DDP, DAP) and multi-currency symbols (USD, EUR, VES, CNY, RMB).
 */
export const FINANCIAL_CONTENT_REGEX =
  /(?:(?:P\.Unit|Precio(?:\s*Unitario)?|Unit\s*(?:Cost|Price)|Total|Costo(?:\s*Total)?|Valor(?:\s*Total)?)[^\n:]*\b(?:FOB|CIF|CFR|EXW|DDP|DAP)\b[\s:=]+(?:(?:USD|EUR|VES|CNY|RMB|Bs\.?)\s*)?(?:[$€¥]\s*)?[0-9][0-9.,]*|(?:[$€¥]|(?:USD|EUR|VES|CNY|RMB|Bs\.?)\s*)[0-9][0-9.,]*\s*\b(?:FOB|CIF|CFR|EXW|DDP|DAP)\b|\b(?:Margen(?:\s*Bruto|\s*Comercial)?|Gross\s*Margin|Profit\s*Margin|Markup)[\s:=]+\d+(?:[.,]\d+)?\s*%)/i;

/**
 * Redacts confidential FOB/CIF/EXW purchase costs and margins from chunk text
 * for sales floor, vendor, and marketing personnel across USD/EUR/VES/CNY/RMB.
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
    .replace(/(?:Costo\s*FOB)[\s:]+\$[0-9.,]+/gi, "Costo FOB: [CONFIDENCIAL]")
    .replace(
      /(?:P\.Unit|Precio(?:\s*Unitario)?|Unit\s*(?:Cost|Price)|Total|Costo(?:\s*Total)?|Valor(?:\s*Total)?)\s*(?:FOB|CIF|CFR|EXW|DDP|DAP)[\s:=]+(?:(?:USD|EUR|VES|CNY|RMB|Bs\.?)\s*)?(?:[$€¥]\s*)?[0-9][0-9.,]*(?:\s*(?:USD|EUR|VES|CNY|RMB|Bs\.?))?/gi,
      "[COSTO CONFIDENCIAL]",
    )
    .replace(
      /(?:[$€¥]|(?:USD|EUR|VES|CNY|RMB|Bs\.?)\s*)[0-9][0-9.,]*\s*\b(?:FOB|CIF|CFR|EXW|DDP|DAP)\b/gi,
      "[COSTO CONFIDENCIAL]",
    )
    .replace(
      /\b(?:Margen(?:\s*Bruto|\s*Comercial)?|Gross\s*Margin|Profit\s*Margin|Markup)[\s:=]+\d+(?:[.,]\d+)?\s*%/gi,
      "Margen: [CONFIDENCIAL]",
    );
}

/**
 * Builds the SQL RBAC domain pushdown predicate over `rag_document_chunks.metadata`
 * and `rag_documents.metadata` so unauthorized chunks are filtered BEFORE `LIMIT` (V-08).
 */
export function buildRagRoleSqlFilter(
  userRole: RagAccessRole,
): SQL | undefined {
  if (userRole === "owner") {
    return undefined;
  }
  return sql`(
    CASE
      WHEN jsonb_typeof(${ragDocumentChunks.metadata}->'allowed_roles') = 'array'
           AND jsonb_array_length(${ragDocumentChunks.metadata}->'allowed_roles') > 0
        THEN (${ragDocumentChunks.metadata}->'allowed_roles') ? ${userRole}
      WHEN jsonb_typeof(${ragDocumentChunks.metadata}->'accessRoles') = 'array'
           AND jsonb_array_length(${ragDocumentChunks.metadata}->'accessRoles') > 0
        THEN (${ragDocumentChunks.metadata}->'accessRoles') ? ${userRole}
      WHEN jsonb_typeof(${ragDocumentChunks.metadata} #> '{accessRules,allowedRoles}') = 'array'
           AND jsonb_array_length(${ragDocumentChunks.metadata} #> '{accessRules,allowedRoles}') > 0
        THEN (${ragDocumentChunks.metadata} #> '{accessRules,allowedRoles}') ? ${userRole}
      WHEN jsonb_typeof(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') > 0
        THEN (${ragDocuments.metadata} #> '{accessRules,allowedRoles}') ? ${userRole}
      WHEN jsonb_typeof(${ragDocuments.metadata}->'accessRoles') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata}->'accessRoles') > 0
        THEN (${ragDocuments.metadata}->'accessRoles') ? ${userRole}
      WHEN jsonb_typeof(${ragDocuments.metadata}->'allowed_roles') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata}->'allowed_roles') > 0
        THEN (${ragDocuments.metadata}->'allowed_roles') ? ${userRole}
      ELSE ${userRole} <> 'vendor'
    END
  )`;
}

/**
 * Builds the SQL vendor scoping predicate over `rag_document_chunks.metadata` and
 * `rag_documents.metadata` matching `isVendorAllowed` BEFORE `LIMIT` (V-08, FINDING-02).
 */
export function buildRagVendorSqlFilter(
  userRole: RagAccessRole,
  userVendorId: string | undefined,
  targetVendorId: string | undefined,
): SQL {
  if (
    userRole === "vendor" &&
    targetVendorId !== undefined &&
    targetVendorId !== userVendorId
  ) {
    return sql`false`;
  }

  const effectiveVendorId =
    userRole === "vendor" ? (userVendorId ?? null) : (targetVendorId ?? null);
  const restrictedVendorExpr = sql`NULLIF(COALESCE(
    ${ragDocumentChunks.metadata}->>'vendorId',
    ${ragDocumentChunks.metadata} #>> '{queryRestrictions,vendorId}',
    ${ragDocuments.metadata}->>'vendorId',
    ${ragDocuments.metadata} #>> '{queryRestrictions,vendorId}'
  ), '')`;

  if (userRole === "vendor") {
    return sql`(
      CASE
        WHEN ${restrictedVendorExpr} IS NOT NULL THEN
          ${effectiveVendorId}::text IS NOT NULL AND ${restrictedVendorExpr} = ${effectiveVendorId}::text
        ELSE
          (
            (jsonb_typeof(${ragDocumentChunks.metadata}->'allowed_roles') = 'array' AND (${ragDocumentChunks.metadata}->'allowed_roles') ? 'vendor')
            OR (jsonb_typeof(${ragDocumentChunks.metadata}->'accessRoles') = 'array' AND (${ragDocumentChunks.metadata}->'accessRoles') ? 'vendor')
            OR (jsonb_typeof(${ragDocumentChunks.metadata} #> '{accessRules,allowedRoles}') = 'array' AND (${ragDocumentChunks.metadata} #> '{accessRules,allowedRoles}') ? 'vendor')
            OR (jsonb_typeof(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') = 'array' AND (${ragDocuments.metadata} #> '{accessRules,allowedRoles}') ? 'vendor')
            OR (jsonb_typeof(${ragDocuments.metadata}->'accessRoles') = 'array' AND (${ragDocuments.metadata}->'accessRoles') ? 'vendor')
            OR (jsonb_typeof(${ragDocuments.metadata}->'allowed_roles') = 'array' AND (${ragDocuments.metadata}->'allowed_roles') ? 'vendor')
          )
      END
    )`;
  }

  const isMgmt = MANAGEMENT_ROLES.has(userRole);
  if (!isMgmt) {
    return effectiveVendorId
      ? sql`false`
      : sql`(${restrictedVendorExpr} IS NULL)`;
  }

  if (effectiveVendorId) {
    return sql`(${restrictedVendorExpr} = ${effectiveVendorId}::text)`;
  }

  return sql`true`;
}

/**
 * Document-level SQL RBAC predicate for `ragRouter.listDocuments` (V-08, FINDING-02).
 */
export function buildRagDocRoleSqlFilter(
  userRole: RagAccessRole,
): SQL | undefined {
  if (userRole === "owner") {
    return undefined;
  }
  return sql`(
    CASE
      WHEN jsonb_typeof(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') > 0
        THEN (${ragDocuments.metadata} #> '{accessRules,allowedRoles}') ? ${userRole}
      WHEN jsonb_typeof(${ragDocuments.metadata}->'accessRoles') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata}->'accessRoles') > 0
        THEN (${ragDocuments.metadata}->'accessRoles') ? ${userRole}
      WHEN jsonb_typeof(${ragDocuments.metadata}->'allowed_roles') = 'array'
           AND jsonb_array_length(${ragDocuments.metadata}->'allowed_roles') > 0
        THEN (${ragDocuments.metadata}->'allowed_roles') ? ${userRole}
      ELSE ${userRole} <> 'vendor'
    END
  )`;
}

/**
 * Document-level SQL vendor predicate for `ragRouter.listDocuments` (V-08, FINDING-02).
 */
export function buildRagDocVendorSqlFilter(
  userRole: RagAccessRole,
  userVendorId: string | undefined,
): SQL {
  const restrictedDocVendorExpr = sql`NULLIF(COALESCE(
    ${ragDocuments.metadata}->>'vendorId',
    ${ragDocuments.metadata} #>> '{queryRestrictions,vendorId}'
  ), '')`;

  if (userRole === "vendor") {
    const vendorParam = userVendorId ?? null;
    return sql`(
      CASE
        WHEN ${restrictedDocVendorExpr} IS NOT NULL THEN
          ${vendorParam}::text IS NOT NULL AND ${restrictedDocVendorExpr} = ${vendorParam}::text
        ELSE
          (
            (jsonb_typeof(${ragDocuments.metadata} #> '{accessRules,allowedRoles}') = 'array' AND (${ragDocuments.metadata} #> '{accessRules,allowedRoles}') ? 'vendor')
            OR (jsonb_typeof(${ragDocuments.metadata}->'accessRoles') = 'array' AND (${ragDocuments.metadata}->'accessRoles') ? 'vendor')
            OR (jsonb_typeof(${ragDocuments.metadata}->'allowed_roles') = 'array' AND (${ragDocuments.metadata}->'allowed_roles') ? 'vendor')
          )
      END
    )`;
  }

  if (!MANAGEMENT_ROLES.has(userRole)) {
    return sql`(${restrictedDocVendorExpr} IS NULL)`;
  }

  return sql`true`;
}

function maskMetadataSurrogates(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/<(PII_[A-Z]+|CONF_[A-Z]+)_[a-f0-9-]+>/gi, (match) => {
      const upper = match.toUpperCase();
      if (upper.startsWith("<PII_RIF_")) return "[RIF PROVEEDOR]";
      if (upper.startsWith("<PII_TAX_")) return "[ID FISCAL PROVEEDOR]";
      if (upper.startsWith("<PII_BANK_"))
        return "[DATOS BANCARIOS RESTRINGIDOS]";
      if (upper.startsWith("<PII_CARD_"))
        return "[TARJETA DE CRÉDITO BLOQUEADA]";
      if (upper.startsWith("<CONF_COST_")) return "[VALOR FOB CONFIDENCIAL]";
      return "[CONFIDENCIAL]";
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskMetadataSurrogates(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskMetadataSurrogates(v);
    }
    return out;
  }
  return value;
}

/**
 * Strips confidential financial keys and PII fiscal/address fields from chunk
 * and document metadata for non-management roles, and masks any surrogate tokens
 * inside remaining string fields (F-05, LOW-01, V-10).
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = maskMetadataSurrogates({ ...metadata }) as Record<
    string,
    unknown
  >;
  delete sanitized.unitCostFob;
  delete sanitized.totalCostFob;
  delete sanitized.costFob;
  delete sanitized.purchasePrice;
  delete sanitized.fobCost;
  delete sanitized.totalAmount;
  delete sanitized.rif;
  delete sanitized.rifs;
  delete sanitized.issuerRif;
  delete sanitized.buyerRif;
  delete sanitized.address;
  delete sanitized.issuerAddress;
  delete sanitized.buyerAddress;

  if (sanitized.origin && typeof sanitized.origin === "object") {
    const cleanOrigin = {
      ...(sanitized.origin as Record<string, unknown>),
    };
    delete cleanOrigin.rif;
    delete cleanOrigin.address;
    sanitized.origin = cleanOrigin;
  }

  if (sanitized.destination && typeof sanitized.destination === "object") {
    const cleanDest = {
      ...(sanitized.destination as Record<string, unknown>),
    };
    delete cleanDest.rif;
    delete cleanDest.address;
    sanitized.destination = cleanDest;
  }

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

  // 0. Phase 3 Structural Normalization & Input Guardrail Evaluation
  const sanitizedQuery = sanitizeDocumentStructuralContent(input.query).trim();
  if (sanitizedQuery.length === 0) {
    throw new RagGuardrailViolationError(
      "EMPTY_AFTER_STRUCTURAL_SANITIZATION",
      1.0,
    );
  }
  if (process.env.ENABLE_RAG_GUARDRAILS !== "false") {
    const guardrailDecision = evaluateInputGuardrails(sanitizedQuery);
    if (!guardrailDecision.passed) {
      throw new RagGuardrailViolationError(
        guardrailDecision.reason ?? "PROMPT_INJECTION_DETECTED",
        guardrailDecision.score,
      );
    }
  }

  // 1. Generate 1536-dimensional query embedding on structurally sanitized query
  const queryEmbedding = await generateEmbedding(sanitizedQuery);

  // 2. Build schema-qualified pgvector cosine distance expression (`extensions.<=>`)
  //    so HNSW index scans work regardless of connection `search_path`.
  const vectorLiteral = `[${queryEmbedding.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
  const distanceExpr = sql<number>`(${ragDocumentChunks.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector)`;

  // 2.5 Configure transaction-local pgvector HNSW recall & iterative scan GUCs (V-04, FINDING-01)
  //     `hnsw.ef_search` runs outside the nested EXCEPTION subtransaction so pgvector < 0.8
  //     environments never roll back `ef_search` when `hnsw.iterative_scan` is unrecognized.
  const execFn = (
    ctx.db as unknown as {
      execute?: (q: ReturnType<typeof sql>) => Promise<unknown>;
    }
  ).execute;
  if (typeof execFn === "function") {
    await execFn.call(
      ctx.db,
      sql`DO $$ BEGIN PERFORM set_config('hnsw.ef_search', '100', true); BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END; END $$;`,
    );
  }

  // 3. Query pgvector chunks with double-lock tenant isolation and SQL RBAC + vendor pushdown
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
    .innerJoin(
      ragDocuments,
      and(
        eq(ragDocumentChunks.documentId, ragDocuments.id),
        // Double-Lock: explicit workspace matching on joined table (V-11)
        eq(ragDocuments.workspaceId, ctx.workspace.workspaceId),
      ),
    )
    .where(
      and(
        // Double-Lock: explicit workspace filter on primary target chunks (V-11)
        eq(ragDocumentChunks.workspaceId, ctx.workspace.workspaceId),
        input.documentType
          ? eq(ragDocuments.documentType, input.documentType)
          : undefined,
        // SQL RBAC + Vendor pushdown across chunk & document accessRules (V-08, FINDING-02)
        buildRagRoleSqlFilter(userRole),
        buildRagVendorSqlFilter(userRole, userVendorId, input.vendorId),
      ),
    )
    .orderBy(asc(distanceExpr))
    .limit(Math.min(100, Math.max(input.limit * 3, 20))); // Oversample for similarity threshold filtering

  // 4. Post-query filtering: similarity threshold, RBAC, and vendor scoping
  const authorizedRows: {
    row: (typeof rows)[number];
    similarity: number;
    distance: number;
    chunkMeta: Record<string, unknown>;
    docMeta: Record<string, unknown>;
  }[] = [];

  for (const row of rows) {
    const rawDist = Number(row.distance);
    const distance = Number.isNaN(rawDist) ? 1.0 : rawDist;
    const similarity = Math.max(0.0, Math.min(1.0, 1.0 - distance));

    if (similarity < input.minScore) {
      continue;
    }

    const chunkMeta = (row.chunkMetadata ?? {}) as Record<string, unknown>;
    const docMeta = (row.documentMetadata ?? {}) as Record<string, unknown>;

    if (!isRoleAllowed(userRole, chunkMeta, docMeta)) {
      continue;
    }

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

    authorizedRows.push({ row, similarity, distance, chunkMeta, docMeta });
    if (authorizedRows.length >= input.limit) {
      break;
    }
  }

  // 5. Batched document-scoped PII re-hydration across content, documentNumber & metadata (F-02, FINDING-05)
  //    Executed sequentially on `ctx.db` so a single `pg.PoolClient` inside `runInWorkspaceRlsReadonly`
  //    never receives overlapping concurrent queries.
  const rehydratedTexts = await rehydrateChunksBatch(
    authorizedRows.map((entry) => ({
      documentId: entry.row.documentId,
      content: entry.row.content,
    })),
    ctx.workspace.workspaceId,
    userRole,
    ctx.db,
  );
  const rehydratedDocNumbers = await rehydrateChunksBatch(
    authorizedRows.map((entry) => ({
      documentId: entry.row.documentId,
      content: entry.row.documentNumber ?? "",
    })),
    ctx.workspace.workspaceId,
    userRole,
    ctx.db,
  );
  const rehydratedTitles = await rehydrateChunksBatch(
    authorizedRows.map((entry) => ({
      documentId: entry.row.documentId,
      content: entry.row.documentTitle || "",
    })),
    ctx.workspace.workspaceId,
    userRole,
    ctx.db,
  );
  const rehydratedMetas = await rehydrateMetadataBatch(
    authorizedRows.map((entry) => ({
      documentId: entry.row.documentId,
      metadata: {
        ...entry.chunkMeta,
        documentMetadata: entry.docMeta,
      },
    })),
    ctx.workspace.workspaceId,
    userRole,
    ctx.db,
  );

  const matchingResults: RagSearchResultItem[] = [];
  for (let idx = 0; idx < authorizedRows.length; idx++) {
    const entry = authorizedRows[idx];
    if (!entry) continue;
    const { row, similarity, distance, chunkMeta, docMeta } = entry;
    let finalContent = rehydratedTexts[idx] ?? row.content;
    let finalMetadata: Record<string, unknown> = rehydratedMetas[idx] ?? {
      ...chunkMeta,
      documentMetadata: docMeta,
    };

    // Server-side confidential classification (V-10):
    const hasFinancialContent =
      row.documentType === "commercial_invoice" ||
      row.documentType === "fiscal_invoice" ||
      FINANCIAL_CONTENT_REGEX.test(finalContent);

    const isConfidential =
      hasFinancialContent ||
      chunkMeta.confidentialCosts === true ||
      docMeta.confidentialCosts === true ||
      (docMeta.queryRestrictions as { confidentialCosts?: boolean } | undefined)
        ?.confidentialCosts === true ||
      (docMeta.totals as { totalAmount?: number } | undefined)?.totalAmount !==
        undefined;

    if (!isManagement) {
      if (isConfidential) {
        finalContent = redactConfidentialContent(finalContent);
      }
      finalMetadata = sanitizeMetadata(finalMetadata);
    }

    // Phase 3 Post-Retrieval Output DLP Scanner (content + title + documentNumber)
    finalContent = scanOutputDLP(finalContent).sanitized;
    const rawTitleOut = sanitizeDocumentStructuralContent(
      rehydratedTitles[idx] ?? row.documentTitle,
    ).trim();
    const redactedTitleOut =
      !isManagement && isConfidential
        ? redactConfidentialContent(rawTitleOut)
        : rawTitleOut;
    const safeTitle =
      scanOutputDLP(redactedTitleOut).sanitized || "Documento sin título";
    const rehydratedDocNum = rehydratedDocNumbers[idx] ?? "";
    const safeDocNumber =
      row.documentNumber !== null
        ? scanOutputDLP(rehydratedDocNum).sanitized || row.documentNumber
        : null;

    matchingResults.push({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentType: row.documentType,
      documentNumber: safeDocNumber,
      title: safeTitle,
      chunkIndex: row.chunkIndex,
      chunkType: row.chunkType,
      content: finalContent,
      similarity: Number(similarity.toFixed(4)),
      distance: Number(distance.toFixed(4)),
      tokenCount: row.tokenCount,
      metadata: finalMetadata,
    });
  }

  return {
    results: matchingResults,
    totalMatches: matchingResults.length,
    query: input.query,
  };
}
