/**
 * Cendaro — Hybrid Global Search & Full-ERP Zero-PII Conversational Copilot Validators
 *
 * Shared strict `zod/v4` contracts for:
 *   • `search.global`: Single-pass accent-insensitive + trigram entity search (`⌘K`).
 *   • `search.semantic`: Hybrid pgvector + lexical RRF across `product_embedding`
 *     and `rag_document_chunks` (`gemini-embedding-001` 1,536-dim).
 *   • `search.askAi` & `search.copilotChat`: Full-ERP multi-turn Zero-PII conversational
 *     intelligence combining a <1ms deterministic entity/grammar parser with
 *     `gemini-3.5-flash-lite` structured JSON intent planning (~140 tokens max, 0 DB rows
 *     on wire) and local joined Drizzle execution across all ERP modules.
 */
import { z } from "zod/v4";

import type { RagDocumentType } from "./rag";

// ──────────────────────────────────────────────
// Input Schemas
// ──────────────────────────────────────────────

export const globalSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(120),
});
export type GlobalSearchInput = z.infer<typeof globalSearchInputSchema>;

export const semanticSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(160),
  limit: z.number().int().min(1).max(12).default(8),
});
export type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

export const quickAiQueryInputSchema = z.object({
  q: z.string().trim().min(2).max(240),
});
export type QuickAiQueryInput = z.infer<typeof quickAiQueryInputSchema>;

// ──────────────────────────────────────────────
// Closed Full-ERP Operational & Commercial Intent Schema (Zero Text-to-SQL)
// ──────────────────────────────────────────────

export const QUICK_QUERY_INTENT_TYPES = [
  "daily_pulse",
  "sales_summary",
  "top_products",
  "invoice_lookup",
  "order_detail_lookup",
  "payment_lookup",
  "delivery_note_lookup",
  "credit_note_lookup",
  "cash_closure_status",
  "customer_lookup",
  "supplier_lookup",
  "warehouse_stock_lookup",
  "vendor_commissions_lookup",
  "approvals_alerts_lookup",
  "erp_help",
  "low_stock",
  "overdue_receivables",
  "pending_receivables",
  "pending_orders",
  "unpaid_orders",
  "open_quotes",
  "containers_status",
  "exchange_rate",
  "catalog_lookup",
] as const;

export const quickQueryIntentTypeSchema = z.enum(QUICK_QUERY_INTENT_TYPES);
export type QuickQueryIntentType = z.infer<typeof quickQueryIntentTypeSchema>;

export const quickQueryCurrencySchema = z.enum(["usd", "bs", "rmb"]);
export type QuickQueryCurrency = z.infer<typeof quickQueryCurrencySchema>;

export const quickQueryChannelSchema = z.enum([
  "store",
  "mercadolibre",
  "vendors",
  "whatsapp",
  "instagram",
]);
export type QuickQueryChannel = z.infer<typeof quickQueryChannelSchema>;

export const quickQueryPaymentMethodSchema = z.enum([
  "mobile_payment",
  "transfer",
  "cash",
  "pos_terminal",
  "zelle",
]);
export type QuickQueryPaymentMethod = z.infer<
  typeof quickQueryPaymentMethodSchema
>;

export const quickQueryTimeWindowSchema = z.enum(["today", "7d", "30d", "all"]);
export type QuickQueryTimeWindow = z.infer<typeof quickQueryTimeWindowSchema>;

export const quickQueryOrderSubfilterSchema = z.enum([
  "approval",
  "dispatch",
  "all",
]);
export type QuickQueryOrderSubfilter = z.infer<
  typeof quickQueryOrderSubfilterSchema
>;

export const copilotHelpTopicSchema = z.enum([
  "general",
  "pos_payments",
  "cash_closure",
  "ai_imports",
  "orders_quotes",
  "invoices_fiscal",
  "inventory",
  "containers",
]);
export type CopilotHelpTopic = z.infer<typeof copilotHelpTopicSchema>;

export const quickQueryIntentSchema = z.object({
  intent: quickQueryIntentTypeSchema,
  searchTerm: z.string().trim().max(120).nullable().optional(),
  documentNumber: z.string().trim().max(64).nullable().optional(),
  latestOnly: z.boolean().nullable().optional(),
  minAmountUsd: z.number().nonnegative().max(999_999_999).nullable().optional(),
  onlyOutOfStock: z.boolean().nullable().optional(),
  orderSubfilter: quickQueryOrderSubfilterSchema.nullable().optional(),
  channel: quickQueryChannelSchema.nullable().optional(),
  paymentMethod: quickQueryPaymentMethodSchema.nullable().optional(),
  timeWindow: quickQueryTimeWindowSchema.nullable().optional(),
  convertAmount: z
    .number()
    .positive()
    .max(999_999_999_999)
    .nullable()
    .optional(),
  fromCurrency: quickQueryCurrencySchema.nullable().optional(),
  toCurrency: quickQueryCurrencySchema.nullable().optional(),
  helpTopic: copilotHelpTopicSchema.nullable().optional(),
});
export type QuickQueryIntent = z.infer<typeof quickQueryIntentSchema>;

// ──────────────────────────────────────────────
// Multi-Turn Copilot History & Chat Input
// ──────────────────────────────────────────────

export const copilotHistoryTurnSchema = z.object({
  userText: z.string().trim().min(1).max(240),
  intent: quickQueryIntentTypeSchema,
  searchTerm: z.string().trim().max(120).nullable().optional(),
  documentNumber: z.string().trim().max(64).nullable().optional(),
  orderSubfilter: quickQueryOrderSubfilterSchema.nullable().optional(),
  channel: quickQueryChannelSchema.nullable().optional(),
  paymentMethod: quickQueryPaymentMethodSchema.nullable().optional(),
  timeWindow: quickQueryTimeWindowSchema.nullable().optional(),
  minAmountUsd: z.number().nonnegative().max(999_999_999).nullable().optional(),
  onlyOutOfStock: z.boolean().nullable().optional(),
});
export type CopilotHistoryTurn = z.infer<typeof copilotHistoryTurnSchema>;

export const copilotChatInputSchema = z.object({
  message: z.string().trim().min(2).max(320),
  history: z.array(copilotHistoryTurnSchema).max(6).default([]),
});
export type CopilotChatInput = z.infer<typeof copilotChatInputSchema>;

// ──────────────────────────────────────────────
// Output Contracts
// ──────────────────────────────────────────────

export type CopilotTone =
  "default" | "success" | "warning" | "destructive" | "info" | "neutral";

export interface SemanticSearchProductHit {
  id: string;
  sku: string;
  name: string;
  brandName: string | null;
  categoryName: string | null;
  status: string;
  similarity: number;
  rrfScore: number;
  href: string;
}

export interface SemanticSearchDocumentHit {
  chunkId: string;
  documentId: string;
  documentType: RagDocumentType;
  documentNumber: string | null;
  title: string;
  snippet: string;
  similarity: number;
  href: string;
}

export interface SemanticSearchResponse {
  query: string;
  source: "pgvector" | "cache" | "degraded";
  degradedReason?: "quota_reserved" | "guardrail" | "provider_unavailable";
  products: SemanticSearchProductHit[];
  documents: SemanticSearchDocumentHit[];
  latencyMs: number;
}

export interface QuickQueryKpi {
  label: string;
  value: string;
  tone?: CopilotTone;
}

export interface CopilotDetailField {
  label: string;
  value: string;
  mono?: boolean;
  tone?: CopilotTone;
}

export interface CopilotQuickAction {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

export interface QuickQueryResultRow {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeTone?: CopilotTone;
  href: string;
}

export interface QuickAiQueryResponse {
  query: string;
  intent: QuickQueryIntentType;
  source: "deterministic" | "gemini-flash-lite" | "cache" | "degraded";
  headline: string;
  summary: string;
  accessDenied?: boolean;
  details?: CopilotDetailField[];
  quickActions?: CopilotQuickAction[];
  kpis: QuickQueryKpi[];
  items: QuickQueryResultRow[];
  deepLink: {
    label: string;
    href: string;
  } | null;
  latencyMs: number;
}

export interface CopilotChatResponse {
  reply: string;
  headline: string;
  intent: QuickQueryIntentType;
  resolvedFilters: {
    searchTerm?: string | null;
    documentNumber?: string | null;
    orderSubfilter?: QuickQueryOrderSubfilter | null;
    channel?: QuickQueryChannel | null;
    paymentMethod?: QuickQueryPaymentMethod | null;
    timeWindow?: QuickQueryTimeWindow | null;
    minAmountUsd?: number | null;
    onlyOutOfStock?: boolean | null;
  };
  source: "deterministic" | "gemini-flash-lite" | "cache" | "degraded";
  accessDenied?: boolean;
  details: CopilotDetailField[];
  quickActions: CopilotQuickAction[];
  kpis: QuickQueryKpi[];
  items: QuickQueryResultRow[];
  deepLink: {
    label: string;
    href: string;
  } | null;
  followUps: string[];
  latencyMs: number;
}
