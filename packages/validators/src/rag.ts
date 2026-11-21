/**
 * Cendaro — RAG System Validation Schemas & Domain Types
 *
 * Zod v4 schemas for commercial document processing (packing lists, invoices,
 * delivery notes), hierarchical chunking, vector semantic search, and RLS access rules.
 */
import { z } from "zod/v4";

// ──────────────────────────────────────────────
// Document & Chunk Type Primitives
// ──────────────────────────────────────────────

export const RAG_DOCUMENT_TYPES = [
  "packing_list",
  "commercial_invoice",
  "fiscal_invoice",
  "delivery_note",
] as const;

export type RagDocumentType = (typeof RAG_DOCUMENT_TYPES)[number];

export const ragDocumentTypeSchema = z.enum(RAG_DOCUMENT_TYPES);

export const RAG_ACCESS_ROLES = [
  "owner",
  "admin",
  "supervisor",
  "employee",
  "vendor",
  "marketing",
] as const;

export type RagAccessRole = (typeof RAG_ACCESS_ROLES)[number];

export const ragAccessRoleSchema = z.enum(RAG_ACCESS_ROLES);

export const RAG_CHUNK_TYPES = [
  "document_summary",
  "row_group",
  "customs_logistics",
  "payment_terms",
] as const;

export type RagChunkType = (typeof RAG_CHUNK_TYPES)[number];

export const ragChunkTypeSchema = z.enum(RAG_CHUNK_TYPES);

export const RAG_DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "indexed",
  "failed",
] as const;

export type RagDocumentStatus = (typeof RAG_DOCUMENT_STATUSES)[number];

export const ragDocumentStatusSchema = z.enum(RAG_DOCUMENT_STATUSES);

// ──────────────────────────────────────────────
// Document Metadata Schemas (Origin, Destination, Access Rules, Query Restrictions, Totals)
// ──────────────────────────────────────────────

/** Origin details (shipper/emisor, origin port, city, country, tax ID) */
export const documentOriginSchema = z
  .object({
    shipper: z.string().optional(),
    entityName: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    port: z.string().optional(),
    address: z.string().optional(),
    rif: z.string().optional(),
  })
  .passthrough();

export type DocumentOrigin = z.infer<typeof documentOriginSchema>;

/** Destination details (consignee/buyer, destination warehouse, port, city, country, tax ID) */
export const documentDestinationSchema = z
  .object({
    consignee: z.string().optional(),
    buyerName: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    port: z.string().optional(),
    warehouse: z.string().optional(),
    address: z.string().optional(),
    rif: z.string().optional(),
  })
  .passthrough();

export type DocumentDestination = z.infer<typeof documentDestinationSchema>;

/** Access rules for multi-tenant and role-based field redaction */
export const documentAccessRulesSchema = z
  .object({
    allowedRoles: z
      .array(ragAccessRoleSchema)
      .default(["owner", "admin", "supervisor", "employee"]),
    restrictedFields: z.array(z.string()).optional(),
  })
  .passthrough();

export type DocumentAccessRules = z.infer<typeof documentAccessRulesSchema>;

/** Query restrictions (e.g. vendor-scoped queries, confidential cost flags) */
export const documentQueryRestrictionsSchema = z
  .object({
    vendorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    confidentialCosts: z.boolean().default(false),
  })
  .passthrough();

export type DocumentQueryRestrictions = z.infer<
  typeof documentQueryRestrictionsSchema
>;

/** Document identification numbers (control number, invoice, container, etc.) */
export const documentNumbersSchema = z
  .object({
    documentNumber: z.string().optional(),
    controlNumber: z.string().optional(),
    invoiceNumber: z.string().optional(),
    containerNumber: z.string().optional(),
    orderNumber: z.string().optional(),
    deliveryNoteNumber: z.string().optional(),
    blNumber: z.string().optional(),
  })
  .passthrough();

export type DocumentNumbers = z.infer<typeof documentNumbersSchema>;

/** Financial and logistical totals */
export const documentTotalsSchema = z
  .object({
    totalAmount: z.number().optional(),
    currency: z.string().default("USD"),
    subtotal: z.number().optional(),
    tax: z.number().optional(),
    totalPackages: z.number().int().optional(),
    totalWeightKg: z.number().optional(),
    totalVolumeCbm: z.number().optional(),
    totalItems: z.number().int().optional(),
  })
  .passthrough();

export type DocumentTotals = z.infer<typeof documentTotalsSchema>;

/** Comprehensive document metadata schema */
export const documentMetadataSchema = z
  .object({
    origin: documentOriginSchema.optional(),
    destination: documentDestinationSchema.optional(),
    accessRules: documentAccessRulesSchema.optional(),
    queryRestrictions: documentQueryRestrictionsSchema.optional(),
    documentNumbers: documentNumbersSchema.optional(),
    totals: documentTotalsSchema.optional(),
    // Direct convenience properties for fast access:
    controlNumber: z.string().optional(),
    invoiceNumber: z.string().optional(),
    containerNumber: z.string().optional(),
    orderNumber: z.string().optional(),
    blNumber: z.string().optional(),
    totalAmount: z.number().optional(),
    currency: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

// ──────────────────────────────────────────────
// Storage URL Validation (V-12)
// ──────────────────────────────────────────────

function hasAsciiControlOrWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a fileUrl belongs to an owned Supabase storage bucket and origin,
 * and optionally matches the specified workspace ID directory (V-12).
 */
export function isOwnedStorageUrl(
  url: string | undefined | null,
  workspaceId?: string,
): boolean {
  if (!url || typeof url !== "string") return false;

  const trimmed = url.trim();
  if (trimmed.length === 0) return false;

  // Reject any embedded whitespace or ASCII control chars (\t, \n, \r, \0, etc.)
  // to eliminate WHATWG URL parser differentials (`ht\ttps://`, `/\t/evil`, `.\t.`)
  if (hasAsciiControlOrWhitespace(trimmed)) {
    return false;
  }

  // Reject protocol-relative URLs upfront
  if (trimmed.startsWith("//")) {
    return false;
  }

  // Reject path traversal and encoded separator exploits (F-09)
  if (
    trimmed.includes("..") ||
    /%(?:2e|2f|5c|25)/i.test(trimmed) ||
    trimmed.includes("\\")
  ) {
    return false;
  }

  // Reject JavaScript, data, or local schemes
  if (/^(?:javascript|data|file|vbscript|blob):/i.test(trimmed)) {
    return false;
  }

  // Strictly classify as canonical double-slash http(s):// OR leading-slash relative path
  // (rejects single-slash `http:/evil...` and scheme-prefixed `http:evil...` differentials)
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isRelativePath = trimmed.startsWith("/") && !trimmed.startsWith("//");
  if (!isAbsolute && !isRelativePath) {
    return false;
  }

  // If workspaceId is provided, validate UUID format
  if (
    workspaceId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      workspaceId,
    )
  ) {
    return false;
  }

  try {
    const URLCtor = (
      globalThis as unknown as {
        URL: new (
          url: string,
          base?: string,
        ) => {
          protocol: string;
          hostname: string;
          pathname: string;
        };
      }
    ).URL;

    const parsed = isAbsolute
      ? new URLCtor(trimmed)
      : new URLCtor(trimmed, "https://supabase.internal");

    // Enforce HTTP / HTTPS protocol
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    // Unconditional host validation (relative URLs must stay pinned to supabase.internal)
    const hostname = parsed.hostname.toLowerCase();
    if (
      isRelativePath &&
      (parsed.protocol !== "https:" || hostname !== "supabase.internal")
    ) {
      return false;
    }

    // Prohibit link-local, cloud metadata IPs, and IPv6 loopbacks
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname === "instance-data"
    ) {
      return false;
    }

    const runtimeEnv = (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env;

    const isProd = runtimeEnv?.NODE_ENV === "production";

    if (isProd && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return false;
    }

    const configuredSupabaseUrl = runtimeEnv?.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (isProd && !isRelativePath) {
      if (parsed.protocol !== "https:" || !configuredSupabaseUrl) {
        return false;
      }
      try {
        const expectedHost = new URLCtor(
          configuredSupabaseUrl,
        ).hostname.toLowerCase();
        if (hostname !== expectedHost) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // Allowed domains: Supabase production, development localhost/127.0.0.1, or supabase hostnames
    const isAllowedDomain =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "supabase" ||
      hostname === "supabase.internal" ||
      hostname === "supabase-kong" ||
      hostname.endsWith(".supabase.co") ||
      hostname.endsWith(".supabase.in");

    if (!isAllowedDomain) {
      return false;
    }

    // Storage endpoint path validation
    // Format: /storage/v1/object/(?:public|authenticated|sign)/<bucket>/[workspaceId/]...
    const storagePattern =
      /^\/storage\/v1\/object\/(?:public|authenticated|sign)\/[^/]+(?:\/|$)/i;
    if (!storagePattern.test(parsed.pathname)) {
      return false;
    }

    // If workspaceId is provided, enforce workspace tenancy path scoping
    if (workspaceId) {
      const workspacePattern = new RegExp(
        `^/storage/v1/object/(?:public|authenticated|sign)/[^/]+/${workspaceId}(?:/|$)`,
        "i",
      );
      if (!workspacePattern.test(parsed.pathname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Chunk Schemas & Input Types
// ──────────────────────────────────────────────

export const ragChunkInputSchema = z
  .object({
    chunkIndex: z.number().int().nonnegative().optional(),
    chunkType: ragChunkTypeSchema.default("document_summary"),
    content: z
      .string()
      .min(1, "El contenido del fragmento es requerido")
      .max(8000, "El contenido no puede superar 8000 caracteres"),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    tokenCount: z.number().int().positive().optional(),
  })
  .passthrough()
  .refine((val) => !("embedding" in (val as Record<string, unknown>)), {
    message: "No se permite proporcionar embeddings desde el cliente (V-01)",
  });

export type RagChunkInput = z.infer<typeof ragChunkInputSchema>;

// ──────────────────────────────────────────────
// Search & Ingestion Input Schemas
// ──────────────────────────────────────────────

/** Semantic & hybrid vector search input schema */
export const ragSearchInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "La consulta no puede estar vacía")
      .max(1000, "La consulta no puede superar 1000 caracteres"),
    documentType: ragDocumentTypeSchema.optional(),
    limit: z.number().int().positive().max(100).default(10),
    minScore: z.number().min(0).max(1).default(0.5),
    vendorId: z.string().uuid("vendorId debe ser un UUID válido").optional(),
  })
  .strict();

export type RagSearchInput = z.infer<typeof ragSearchInputSchema>;

/** Document ingestion input schema */
export const ragIngestInputSchema = z.object({
  documentType: ragDocumentTypeSchema,
  documentNumber: z.string().max(64).optional(),
  title: z
    .string()
    .min(1, "El título del documento es requerido")
    .max(256, "El título no puede superar 256 caracteres"),
  fileUrl: z
    .string()
    .max(2048)
    .refine((url) => isOwnedStorageUrl(url), {
      message:
        "fileUrl debe pertenecer a un bucket de almacenamiento autorizado de Supabase",
    })
    .optional(),
  fileName: z.string().max(256).optional(),
  metadata: documentMetadataSchema.optional().default({}),
  chunks: z
    .array(ragChunkInputSchema)
    .min(1, "El documento debe contener al menos un fragmento (chunk)")
    .max(500, "El documento no puede superar 500 fragmentos"),
});

export type RagIngestInput = z.infer<typeof ragIngestInputSchema>;
