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
// Chunk Schemas & Input Types
// ──────────────────────────────────────────────

export const ragChunkInputSchema = z
  .object({
    chunkIndex: z.number().int().nonnegative().optional(),
    chunkType: ragChunkTypeSchema.default("document_summary"),
    content: z.string().min(1, "El contenido del fragmento es requerido"),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    embedding: z
      .array(z.number())
      .length(1536, "El embedding debe tener exactamente 1536 dimensiones")
      .optional(),
    tokenCount: z.number().int().positive().optional(),
  })
  .passthrough();

export type RagChunkInput = z.infer<typeof ragChunkInputSchema>;

// ──────────────────────────────────────────────
// Search & Ingestion Input Schemas
// ──────────────────────────────────────────────

/** Semantic & hybrid vector search input schema */
export const ragSearchInputSchema = z
  .object({
    query: z
      .string()
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
  fileUrl: z.string().optional(),
  fileName: z.string().max(256).optional(),
  metadata: documentMetadataSchema.optional().default({}),
  chunks: z
    .array(ragChunkInputSchema)
    .min(1, "El documento debe contener al menos un fragmento (chunk)"),
});

export type RagIngestInput = z.infer<typeof ragIngestInputSchema>;
