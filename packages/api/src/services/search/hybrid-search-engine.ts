/**
 * Cendaro — 3-Tier Hybrid Global Search & Zero-PII Operational Query Engine
 *
 * Powers Cendaro's `⌘K` Command Palette entirely within the Google Gemini Free Tier ($0/mo):
 *   • Tier 0 (`search.global` in `modules/search.ts`): <25ms accent-folded + `pg_trgm` SQL.
 *   • Tier 1 (`executeSemanticHybridSearch`): `gemini-embedding-001` (1,536-dim) + pgvector HNSW
 *     Reciprocal Rank Fusion (RRF k=60) across `product_embedding` & `rag_document_chunks`,
 *     shielded by L1 tenant-isolated LRU cache and 4-rule `rate_limit_bucket` quota reservation.
 *   • Tier 2 (`executeQuickAiQuery`):
 *       - Stage A (<1ms, 0 API calls): deterministic bilingual ERP grammar parser.
 *       - Stage B (~640ms, `gemini-3.5-flash-lite` JSON mode without `responseSchema`/`thinkingConfig`):
 *         Zero-PII intent classification (`zod/v4` closed union — never Text-to-SQL).
 *       - Stage C (<20ms): local Drizzle execution inside `runInWorkspaceRlsReadonly` enforcing
 *         RBAC (`can`), plan module gates (`isModuleEnabled`), `vendorScopeId`, and 0% cost exposure.
 */

import { and, asc, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import type {
  CopilotChatInput,
  CopilotChatResponse,
  CopilotHelpTopic,
  CopilotHistoryTurn,
  QuickAiQueryInput,
  QuickAiQueryResponse,
  QuickQueryChannel,
  QuickQueryCurrency,
  QuickQueryIntent,
  QuickQueryKpi,
  QuickQueryPaymentMethod,
  QuickQueryResultRow,
  QuickQueryTimeWindow,
  SemanticSearchDocumentHit,
  SemanticSearchInput,
  SemanticSearchProductHit,
  SemanticSearchResponse,
  UserRole,
} from "@cendaro/validators";
import {
  AccountReceivable,
  Brand,
  Category,
  Container,
  ContainerItem,
  Customer,
  ExchangeRate,
  Product,
  ProductEmbedding,
  Quote,
  SalesOrder,
  StockLedger,
} from "@cendaro/db/schema";
import {
  addMoney,
  can,
  convertUsdToVes,
  convertVesToUsd,
  multiplyMoney,
  quickQueryIntentSchema,
  roundMoney2,
  roundMoney4,
  subtractMoney,
} from "@cendaro/validators";

import { logger } from "../../logger";
import { vendorScopeId } from "../../modules/vendor-scope";
import {
  isModuleEnabled,
  runInWorkspaceRls,
  runInWorkspaceRlsReadonly,
} from "../../trpc";
import {
  generateStructuredJson,
  isGenerativeAiConfigured,
} from "../ai/gemini-structured";
import {
  buildSearchQuerySkipPiiSet,
  evaluateInputGuardrails,
  generateEmbedding,
  logRagAuditEvent,
  RagEmbeddingProviderError,
  RagGuardrailViolationError,
  resolveActiveEmbeddingProviderName,
  sanitizeDocumentStructuralContent,
  searchRagChunks,
  sha256Hex,
  syncWorkspaceProductEmbeddings,
  tokenizeAndVaultContent,
} from "../rag";
import { getRateLimitStore } from "../rate-limit";
import {
  executeApprovalsAlertsLookup,
  executeCashClosureStatus,
  executeCreditNoteLookup,
  executeCustomerDossierLookup,
  executeDeliveryNoteLookup,
  executeInvoiceLookup,
  executeOrderDetailLookup,
  executePaymentLookup,
  executeProductDossierLookup,
  executeSupplierLookup,
  executeTopProductsLookup,
  executeVendorCommissionsLookup,
  executeWarehouseStockLookup,
} from "./copilot-domain-handlers";

type Db = ReturnType<typeof getDb>;

export interface HybridSearchExecutionContext {
  db: Db;
  workspace: {
    workspaceId: string;
    memberId: string;
    role: UserRole;
    plan: "starter" | "pro" | "enterprise";
  };
  user: {
    id: string;
    email?: string | null;
  };
  afterCommit: ((poolDb: Db) => Promise<unknown>)[];
}

// ──────────────────────────────────────────────
// Accent Folding & Lexical Helpers (Zero `unaccent` Extension Needed)
// ──────────────────────────────────────────────

export const SQL_ACCENT_FROM = "áéíóúàèìòùäëïöüâêîôûãõñç";
export const SQL_ACCENT_TO = "aeiouaeiouaeiouaeiouaonc";

/**
 * Folds accents, case, and Unicode compatibility forms identically to
 * `pg_catalog.translate(lower(col), SQL_ACCENT_FROM, SQL_ACCENT_TO)`.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLikeSql(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const SEARCH_STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "con",
  "por",
  "para",
  "un",
  "una",
  "que",
  "the",
  "for",
  "with",
  "and",
]);

function extractLexicalTokens(value: string): Set<string> {
  const folded = foldSearchText(value);
  const rawTokens = folded.match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens = new Set<string>();
  for (const tok of rawTokens) {
    if (SEARCH_STOPWORDS.has(tok)) continue;
    if (tok.length >= 2 || /^\d+$/.test(tok)) {
      tokens.add(tok);
    }
  }
  return tokens;
}

function computeLexicalOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const tok of a) {
    if (b.has(tok)) hits++;
  }
  if (hits === 0) return 0;
  const dice = (2 * hits) / (a.size + b.size);
  const containment = hits / Math.min(a.size, b.size);
  return dice * 0.5 + containment * 0.5;
}

// ──────────────────────────────────────────────
// Bounded Tenant-Scoped L1 LRU Caches
// ──────────────────────────────────────────────

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

class BoundedTtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

const embeddingQueryCache = new BoundedTtlCache<number[]>(500, 10 * 60_000);
const intentParseCache = new BoundedTtlCache<QuickQueryIntent>(300, 5 * 60_000);
const bootstrappedEmbeddingWorkspaces = new BoundedTtlCache<boolean>(
  200,
  30 * 60_000,
);

export function clearHybridSearchCaches(): void {
  embeddingQueryCache.clear();
  intentParseCache.clear();
  bootstrappedEmbeddingWorkspaces.clear();
}

// ──────────────────────────────────────────────
// Multi-Bucket Free-Tier Quota Firewalls (Narrowest -> Widest)
// ──────────────────────────────────────────────

export const SEARCH_EMBED_QUOTA_LIMITS = {
  perUser10s: 8,
  perWorkspace60s: 30,
  globalRpm: 40, // Reserves >=60% of ~100 RPM Free Tier for Container/Catalog imports
  globalRpd: 500, // Reserves >=50% of ~1,000 RPD Free Tier for Container/Catalog imports
} as const;

export const SEARCH_LLM_QUOTA_LIMITS = {
  perUser15s: 4,
  perWorkspace60s: 15,
  globalRpm: 6, // Dedicated to `gemini-3.5-flash-lite`, leaving `3.8-flash` 100% free for imports
  globalRpd: 250,
} as const;

export function buildSearchEmbeddingRateRules(
  userId: string,
  workspaceId: string,
) {
  return [
    {
      key: `hybrid-search:embed:user:${userId}`,
      windowMs: 10_000,
      max: SEARCH_EMBED_QUOTA_LIMITS.perUser10s,
    },
    {
      key: `hybrid-search:embed:ws:${workspaceId}`,
      windowMs: 60_000,
      max: SEARCH_EMBED_QUOTA_LIMITS.perWorkspace60s,
    },
    {
      key: "gemini:embed:search:rpm",
      windowMs: 60_000,
      max: SEARCH_EMBED_QUOTA_LIMITS.globalRpm,
    },
    {
      key: "gemini:embed:search:rpd",
      windowMs: 86_400_000,
      max: SEARCH_EMBED_QUOTA_LIMITS.globalRpd,
    },
  ];
}

export function buildSearchLlmRateRules(userId: string, workspaceId: string) {
  return [
    {
      key: `hybrid-search:llm:user:${userId}`,
      windowMs: 15_000,
      max: SEARCH_LLM_QUOTA_LIMITS.perUser15s,
    },
    {
      key: `hybrid-search:llm:ws:${workspaceId}`,
      windowMs: 60_000,
      max: SEARCH_LLM_QUOTA_LIMITS.perWorkspace60s,
    },
    {
      key: "gemini:llm:search:rpm",
      windowMs: 60_000,
      max: SEARCH_LLM_QUOTA_LIMITS.globalRpm,
    },
    {
      key: "gemini:llm:search:rpd",
      windowMs: 86_400_000,
      max: SEARCH_LLM_QUOTA_LIMITS.globalRpd,
    },
  ];
}

export async function consumeSearchEmbeddingBudget(
  userId: string,
  workspaceId: string,
): Promise<{ allowed: boolean; blockedBy?: string }> {
  const res = await getRateLimitStore().consume(
    buildSearchEmbeddingRateRules(userId, workspaceId),
    Date.now(),
  );
  return { allowed: res.success, blockedBy: res.blockedBy };
}

export async function consumeSearchLlmBudget(
  userId: string,
  workspaceId: string,
): Promise<{ allowed: boolean; blockedBy?: string }> {
  const res = await getRateLimitStore().consume(
    buildSearchLlmRateRules(userId, workspaceId),
    Date.now(),
  );
  return { allowed: res.success, blockedBy: res.blockedBy };
}

// ──────────────────────────────────────────────
// PII-Safe Search Query Masking (Preserves 8-char SKUs & Price Filters)
// ──────────────────────────────────────────────

export function maskSearchQueryForExternalAi(
  sanitizedQuery: string,
  workspaceId: string,
): string {
  const { sanitizedContent } = tokenizeAndVaultContent(
    sanitizedQuery,
    workspaceId,
    "query-ephemeral",
    { skipTypes: buildSearchQuerySkipPiiSet(sanitizedQuery) },
  );
  return sanitizedContent;
}

async function persistSearchAuditEvent(
  poolDb: Db,
  workspaceId: string,
  entry: Parameters<typeof logRagAuditEvent>[1],
): Promise<void> {
  if (canOpenTransaction(poolDb)) {
    await runInWorkspaceRls(poolDb, workspaceId, (tx) =>
      logRagAuditEvent(
        tx as unknown as Parameters<typeof logRagAuditEvent>[0],
        entry,
      ),
    );
  } else {
    await logRagAuditEvent(undefined, entry);
  }
}

function isUndefinedTableError(err: unknown): boolean {
  const code =
    (err as { code?: string } | null)?.code ??
    (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "42P01";
}

function canOpenTransaction(db: Db): boolean {
  return (
    typeof (db as unknown as { transaction?: unknown }).transaction ===
    "function"
  );
}

async function runReadonlyIfSupported<T>(
  db: Db,
  workspaceId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  if (canOpenTransaction(db)) {
    return runInWorkspaceRlsReadonly(db, workspaceId, fn);
  }
  return fn(db);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatUsd(amount: number): string {
  return `$${roundMoney2(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBs(amount: number): string {
  return `Bs. ${roundMoney2(amount).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ──────────────────────────────────────────────
// TIER 1: Hybrid Semantic Search (`product_embedding` + `rag_document_chunks`)
// ──────────────────────────────────────────────

export async function executeSemanticHybridSearch(
  ctx: HybridSearchExecutionContext,
  input: SemanticSearchInput,
): Promise<SemanticSearchResponse> {
  const startedAt = Date.now();
  const { workspaceId, role } = ctx.workspace;

  const sanitizedQuery = sanitizeDocumentStructuralContent(input.q).trim();
  if (sanitizedQuery.length < 2) {
    return {
      query: input.q,
      source: "degraded",
      degradedReason: "guardrail",
      products: [],
      documents: [],
      latencyMs: Date.now() - startedAt,
    };
  }

  if (process.env.ENABLE_RAG_GUARDRAILS !== "false") {
    const decision = evaluateInputGuardrails(sanitizedQuery);
    if (!decision.passed) {
      const latencyMs = Date.now() - startedAt;
      const maskedForAudit = maskSearchQueryForExternalAi(
        sanitizedQuery,
        workspaceId,
      );
      ctx.afterCommit.push((poolDb) =>
        persistSearchAuditEvent(poolDb, workspaceId, {
          workspaceId,
          userId: ctx.user.id,
          operationType: "guardrail_violation",
          queryText: maskedForAudit,
          latencyMs,
          metadata: {
            tier: "semantic_hybrid",
            reason: decision.reason ?? "PROMPT_INJECTION_DETECTED",
            score: decision.score,
          },
        }),
      );
      return {
        query: input.q,
        source: "degraded",
        degradedReason: "guardrail",
        products: [],
        documents: [],
        latencyMs,
      };
    }
  }

  // Check module & role permissions BEFORE spending any Gemini embedding quota
  const canReadCatalog =
    can(role, "catalog", "read") && (await isModuleEnabled(ctx, "catalog"));
  const canReadDocs =
    can(role, "orders", "read") && (await isModuleEnabled(ctx, "orders"));
  const canLinkContainers =
    can(role, "containers", "read") &&
    (await isModuleEnabled(ctx, "containers"));

  if (!canReadCatalog && !canReadDocs) {
    return {
      query: input.q,
      source: "pgvector",
      products: [],
      documents: [],
      latencyMs: Date.now() - startedAt,
    };
  }

  const maskedQuery = maskSearchQueryForExternalAi(sanitizedQuery, workspaceId);
  const foldedMasked = foldSearchText(maskedQuery);
  let providerName: "openai" | "gemini" | "local";
  try {
    providerName = resolveActiveEmbeddingProviderName();
  } catch {
    return {
      query: input.q,
      source: "degraded",
      degradedReason: "provider_unavailable",
      products: [],
      documents: [],
      latencyMs: Date.now() - startedAt,
    };
  }

  const cacheKey = sha256Hex(`${workspaceId}|${providerName}|${foldedMasked}`);
  let queryEmbedding = embeddingQueryCache.get(cacheKey);
  let fromCache = true;

  if (!queryEmbedding) {
    fromCache = false;
    const budget = await consumeSearchEmbeddingBudget(ctx.user.id, workspaceId);
    if (!budget.allowed) {
      return {
        query: input.q,
        source: "degraded",
        degradedReason: "quota_reserved",
        products: [],
        documents: [],
        latencyMs: Date.now() - startedAt,
      };
    }

    try {
      queryEmbedding = await generateEmbedding(maskedQuery, {
        timeoutMs: 3_500,
      });
      embeddingQueryCache.set(cacheKey, queryEmbedding);
    } catch (err) {
      if (err instanceof RagEmbeddingProviderError) {
        logger.warn("Semantic search degraded: embedding provider error", {
          module: "hybrid-search",
          workspaceId,
        });
      }
      return {
        query: input.q,
        source: "degraded",
        degradedReason: "provider_unavailable",
        products: [],
        documents: [],
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  const activeEmbedding = queryEmbedding;
  const queryTokens = extractLexicalTokens(sanitizedQuery);
  const vectorLiteral = `[${activeEmbedding.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;

  const { products, documents, shouldBootstrapCatalogEmbeddings } =
    await runReadonlyIfSupported(ctx.db, workspaceId, async (tx) => {
      const execFn = (
        tx as unknown as {
          execute?: (q: ReturnType<typeof sql>) => Promise<unknown>;
        }
      ).execute;
      if (typeof execFn === "function") {
        await execFn.call(
          tx,
          sql`DO $$ BEGIN PERFORM set_config('hnsw.ef_search', '80', true); BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END; END $$;`,
        );
      }

      const productHits: SemanticSearchProductHit[] = [];
      let needsBootstrap = false;

      if (canReadCatalog) {
        try {
          const distanceExpr = sql<number>`(${ProductEmbedding.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector)`;
          const candidateLimit = Math.min(30, Math.max(input.limit * 3, 15));
          const rows = await tx
            .select({
              id: Product.id,
              sku: Product.sku,
              name: Product.name,
              status: Product.status,
              brandName: Brand.name,
              categoryName: Category.name,
              searchDocument: ProductEmbedding.searchDocument,
              distance: distanceExpr,
            })
            .from(ProductEmbedding)
            .innerJoin(
              Product,
              and(
                eq(ProductEmbedding.productId, Product.id),
                eq(Product.workspaceId, workspaceId),
              ),
            )
            .leftJoin(
              Brand,
              and(
                eq(Product.brandId, Brand.id),
                eq(Brand.workspaceId, workspaceId),
              ),
            )
            .leftJoin(
              Category,
              and(
                eq(Product.categoryId, Category.id),
                eq(Category.workspaceId, workspaceId),
              ),
            )
            .where(eq(ProductEmbedding.workspaceId, workspaceId))
            .orderBy(asc(distanceExpr))
            .limit(candidateLimit);

          if (rows.length === 0) {
            const existingAny = await tx
              .select({ id: ProductEmbedding.productId })
              .from(ProductEmbedding)
              .where(eq(ProductEmbedding.workspaceId, workspaceId))
              .limit(1);
            if (existingAny.length === 0) {
              needsBootstrap = true;
            }
          } else {
            // Hybrid Reciprocal Rank Fusion (RRF k = 60): combines vector rank + lexical overlap rank
            const scored = rows.map((r, vecIdx) => {
              const rawDist = Number(r.distance);
              const distance = Number.isNaN(rawDist) ? 1.0 : rawDist;
              const similarity = Math.max(0, Math.min(1, 1 - distance));
              const docTokens = extractLexicalTokens(
                r.searchDocument || `${r.sku} ${r.name}`,
              );
              const lexScore = computeLexicalOverlap(queryTokens, docTokens);
              return { row: r, vecRank: vecIdx + 1, similarity, lexScore };
            });

            const byLexical = [...scored].sort(
              (a, b) => b.lexScore - a.lexScore,
            );
            const lexRankMap = new Map<string, number>();
            for (let i = 0; i < byLexical.length; i++) {
              const item = byLexical[i];
              if (item && item.lexScore > 0) {
                lexRankMap.set(item.row.id, i + 1);
              }
            }

            const RRF_K = 60;
            const fused = scored
              .filter((s) => s.similarity >= 0.56 || s.lexScore >= 0.45)
              .map((s) => {
                const lexRank = lexRankMap.get(s.row.id);
                const rrf =
                  1 / (RRF_K + s.vecRank) +
                  (lexRank ? 0.85 / (RRF_K + lexRank) : 0);
                return { ...s, rrfScore: roundMoney4(rrf) };
              })
              .sort((a, b) => b.rrfScore - a.rrfScore)
              .slice(0, input.limit);

            for (const f of fused) {
              productHits.push({
                id: f.row.id,
                sku: f.row.sku,
                name: f.row.name,
                brandName: f.row.brandName ?? null,
                categoryName: f.row.categoryName ?? null,
                status: f.row.status,
                similarity: roundMoney4(f.similarity),
                rrfScore: f.rrfScore,
                href: `/catalog/${f.row.id}`,
              });
            }
          }
        } catch (err) {
          if (!isUndefinedTableError(err)) {
            logger.warn("Product semantic lookup skipped due to DB error", {
              module: "hybrid-search",
              workspaceId,
            });
          }
        }
      }

      const documentHits: SemanticSearchDocumentHit[] = [];
      if (canReadDocs) {
        try {
          const ragRes = await searchRagChunks(
            {
              db: tx,
              workspace: { workspaceId, role },
              user: {
                id: ctx.user.id,
                vendorId: role === "vendor" ? ctx.user.id : undefined,
              },
            },
            {
              query: input.q,
              limit: Math.min(5, input.limit),
              minScore: 0.58,
            },
            { precomputedEmbedding: activeEmbedding },
          );

          for (const item of ragRes.results) {
            const docMeta = (item.metadata.documentMetadata ??
              item.metadata) as Record<string, unknown>;
            const rawContainerId =
              typeof item.metadata.containerId === "string"
                ? item.metadata.containerId
                : typeof docMeta.containerId === "string"
                  ? docMeta.containerId
                  : null;
            const rawOrderId =
              typeof item.metadata.orderId === "string"
                ? item.metadata.orderId
                : typeof docMeta.orderId === "string"
                  ? docMeta.orderId
                  : null;

            let href = "/orders";
            if (
              canLinkContainers &&
              rawContainerId &&
              UUID_REGEX.test(rawContainerId)
            ) {
              href = `/containers/${rawContainerId}`;
            } else if (
              canLinkContainers &&
              item.documentType === "packing_list"
            ) {
              href = "/containers";
            } else if (rawOrderId && UUID_REGEX.test(rawOrderId)) {
              href = `/orders/${rawOrderId}`;
            }

            const compactSnippet = item.content
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 140);

            documentHits.push({
              chunkId: item.chunkId,
              documentId: item.documentId,
              documentType: item.documentType,
              documentNumber: item.documentNumber,
              title: item.title,
              snippet: compactSnippet,
              similarity: item.similarity,
              href,
            });
          }
        } catch (err) {
          if (!isUndefinedTableError(err)) {
            logger.warn("RAG chunk semantic lookup skipped due to DB error", {
              module: "hybrid-search",
              workspaceId,
            });
          }
        }
      }

      return {
        products: productHits,
        documents: documentHits,
        shouldBootstrapCatalogEmbeddings: needsBootstrap,
      };
    });

  // One-time non-blocking delta warmup if workspace catalog hasn't been embedded yet
  if (
    shouldBootstrapCatalogEmbeddings &&
    !bootstrappedEmbeddingWorkspaces.get(workspaceId)
  ) {
    bootstrappedEmbeddingWorkspaces.set(workspaceId, true);
    ctx.afterCommit.push(async (poolDb) => {
      const ids = await runReadonlyIfSupported(
        poolDb,
        workspaceId,
        async (tx) => {
          const prods = await tx
            .select({ id: Product.id })
            .from(Product)
            .where(
              and(
                eq(Product.workspaceId, workspaceId),
                eq(Product.status, "active"),
              ),
            )
            .limit(80);
          return prods.map((p) => p.id);
        },
      );
      if (ids.length > 0) {
        await syncWorkspaceProductEmbeddings(poolDb, workspaceId, {
          productIds: ids,
          maxBatchLimit: 80,
        });
      }
    });
  }

  const latencyMs = Date.now() - startedAt;
  const retrievedChunkIds = documents.map((d) => d.chunkId);
  ctx.afterCommit.push((poolDb) =>
    persistSearchAuditEvent(poolDb, workspaceId, {
      workspaceId,
      userId: ctx.user.id,
      operationType: "search",
      queryText: maskedQuery,
      retrievedChunkIds,
      outputHash: sha256Hex(
        `${products.map((p) => p.id).join(",")}|${retrievedChunkIds.join(",")}`,
      ),
      latencyMs,
      metadata: {
        tier: "semantic_hybrid",
        cacheHit: fromCache,
        productHits: products.length,
        documentHits: documents.length,
      },
    }),
  );

  return {
    query: input.q,
    source: fromCache ? "cache" : "pgvector",
    products,
    documents,
    latencyMs,
  };
}

// ──────────────────────────────────────────────
// TIER 2 STAGE A: Deterministic Local Grammar (< 1ms, 0 Gemini Calls)
// ──────────────────────────────────────────────

function parseCurrencyToken(raw: string): QuickQueryCurrency | null {
  const tok = foldSearchText(raw);
  if (
    tok === "usd" ||
    tok === "dolar" ||
    tok === "dolares" ||
    tok === "dollar" ||
    tok === "dollars" ||
    tok === "$"
  ) {
    return "usd";
  }
  if (
    tok === "bs" ||
    tok === "ves" ||
    tok === "bolivar" ||
    tok === "bolivares" ||
    tok === "bcv"
  ) {
    return "bs";
  }
  if (
    tok === "rmb" ||
    tok === "cny" ||
    tok === "yuan" ||
    tok === "yuanes" ||
    tok === "¥"
  ) {
    return "rmb";
  }
  return null;
}

function parseSearchAmount(raw: string): number | null {
  const s = raw.trim().replace(/[.,]+$/, "");
  if (!s) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  let normalized = s;
  if (hasDot && hasComma) {
    // Whichever separator comes last (`1.500,50` vs `1,500.50`) is the decimal separator
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // `1,500` or `1,500,000` -> thousands; `12,5` or `12,50` -> decimal
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(s)
      ? s.replace(/,/g, "")
      : s.replace(",", ".");
  } else if (hasDot) {
    // `1.500.000` or `1.500` (exact 3-digit grouping) -> thousands; `12.5` or `12.50` -> decimal
    if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
      normalized = s.replace(/\./g, "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumericThresholdUsd(folded: string): number | null {
  const match =
    /(?:mayor(?:es)?\s+a\s+|mas\s+de\s+|sobre\s+|>\s*=?\s*|minimo\s+)\$?\s*(\d[\d.,]*)/i.exec(
      folded,
    );
  if (!match?.[1]) return null;
  const parsed = parseSearchAmount(match[1]);
  return parsed !== null && parsed >= 0 ? roundMoney2(parsed) : null;
}

function extractChannelFilter(folded: string): QuickQueryChannel | null {
  if (/\bmercadolibre\b|\bmercado\s+libre\b|\bmeli\b/.test(folded)) {
    return "mercadolibre";
  }
  if (/\bwhatsapp\b|\bwa\b/.test(folded)) return "whatsapp";
  if (/\binstagram\b|\big\b/.test(folded)) return "instagram";
  if (/\btienda\b|\bpos\b|\bmostrador\b|\bstore\b/.test(folded)) return "store";
  if (/\bvendedor(?:es)?\b|\bvendor(?:s)?\b/.test(folded)) return "vendors";
  return null;
}

function extractTimeWindow(folded: string): QuickQueryTimeWindow | null {
  if (/\bhoy\b|\btoday\b|\bdel\s+dia\b/.test(folded)) return "today";
  if (/\bsemana\b|\b7\s*dias\b|\bweek\b/.test(folded)) return "7d";
  if (/\bmes\b|\b30\s*dias\b|\bmonth\b/.test(folded)) return "30d";
  return null;
}

function extractPaymentMethodFilter(
  folded: string,
): QuickQueryPaymentMethod | null {
  if (/\bzelle\b/.test(folded)) return "zelle";
  if (/\bpago\s+movil\b/.test(folded)) return "mobile_payment";
  if (/\btransferencia(?:s)?\b/.test(folded)) return "transfer";
  if (/\befectivo\b|\bcash\b/.test(folded)) return "cash";
  if (/\bpunto\s+de\s+venta\b|\bbi[o]?pago\b|\btarjeta\b/.test(folded)) {
    return "pos_terminal";
  }
  return null;
}

function extractDocumentCode(rawQuery: string): string | null {
  const explicitMatch =
    /\b((?:FAC|FACT|INV|ORD|PED|NE|NDE|NC|NDC|COT|PRE|FISC)[-\s]?\d[\w-]*|\d{2}-\d{5,10})\b/i.exec(
      rawQuery,
    );
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim().replace(/\s+/g, "-");
  }
  const numTagMatch =
    /(?:\bnumero\s+de\s+(?:factura|control|orden|pedido|nota)\s+|\bnro\.?\s+|\bn°\s+|#\s*)([a-z0-9-]{3,32})\b/i.exec(
      rawQuery,
    );
  return numTagMatch?.[1]?.trim() ?? null;
}

const GENERIC_SUBJECT_STOPWORDS = new Set([
  "hoy",
  "ayer",
  "esta semana",
  "la semana",
  "este mes",
  "el mes",
  "en total",
  "todos",
  "todas",
  "emitida",
  "emitidas",
  "emitido",
  "emitidos",
  "registrado",
  "registrados",
  "pendientes",
  "pendiente",
  "vencidas",
  "vencidos",
  "abiertas",
  "vigentes",
  "zelle",
  "pago movil",
  "efectivo",
  "transferencia",
  "punto de venta",
  "tienda",
  "whatsapp",
  "instagram",
  "mercadolibre",
]);

function cleanEntitySubject(
  candidate: string | undefined | null,
): string | null {
  if (!candidate) return null;
  const cleaned = candidate
    .replace(/[?¿!¡.,;:]+$/g, "")
    .replace(
      /^(?:la\s+empresa|el\s+cliente|la\s+compania|el\s+negocio|la\s+persona|el\s+senor|la\s+senora|sr\.?|sra\.?|a\s+nombre\s+de|vinculad[oa]\s+a|para\s+el\s+cliente|para\s+la\s+empresa)\s+/i,
      "",
    )
    .replace(
      /\s+(?:hoy|ayer|esta\s+semana|este\s+mes|del\s+mes|por\s+favor|en\s+el\s+sistema|rapidamente|mayores?\s+a\s+\$?\d[\d.,]*|mas\s+de\s+\$?\d[\d.,]*)$/i,
      "",
    )
    .trim();
  if (
    cleaned.length < 2 ||
    GENERIC_SUBJECT_STOPWORDS.has(cleaned) ||
    /^(?:mayores?\s+a|mas\s+de|sobre|minimo)\b/i.test(cleaned)
  ) {
    return null;
  }
  return cleaned.slice(0, 120);
}

function extractSubjectAfterPreposition(folded: string): string | null {
  const m =
    /\b(?:emitid[oa]s?\s+(?:a|para|de)|que\s+se\s+(?:le\s+)?(?:emitio|hizo|genero|registro|cobro)\s+(?:a|para|de)|a\s+nombre\s+de|para\s+(?:la\s+empresa|el\s+cliente)|del?\s+(?:la\s+empresa|cliente)|(?:factura|nota\s+de\s+entrega|nota\s+de\s+credito|pedido|orden|compra|pago|cobro|cotizacion|deuda|cuentas?\s+por\s+cobrar)\s+(?:de|del|para))\s+(.{2,80})$/i.exec(
      folded,
    );
  return cleanEntitySubject(m?.[1]);
}

/**
 * Deterministic Stage-A intent recognizer (< 1ms, 0 external API calls).
 * Returns `null` when phrasing is ambiguous/multi-entity so Stage B (`gemini-3.5-flash-lite`)
 * can classify it.
 */
export function parseDeterministicQuickIntent(
  rawQuery: string,
): QuickQueryIntent | null {
  const cleanRaw = rawQuery.replace(/^\?+\s*/, "").trim();
  const folded = foldSearchText(cleanRaw)
    .replace(/^[?¿!¡\s]+/, "")
    .replace(/[?¿!¡\s]+$/, "")
    .trim();
  if (folded.length < 2) return null;

  const docCode = extractDocumentCode(cleanRaw);

  // 1. Currency conversion: e.g. "convierte 1,500 yuanes a bolivares", "250 usd a bcv"
  const convMatch =
    /(?:convierte|convertir|cuanto\s+son|cuanto\s+es|pasar|calcula)?\s*(\d[\d.,]*)\s*(usd|dolar(?:es)?|dollars?|\$|bs|ves|bolivar(?:es)?|rmb|cny|yuan(?:es)?)\s*(?:a|en|to|in)\s*(usd|dolar(?:es)?|dollars?|bs|ves|bolivar(?:es)?|bcv|rmb|cny|yuan(?:es)?)/i.exec(
      folded,
    );
  if (convMatch?.[1] && convMatch[2] && convMatch[3]) {
    const amount = parseSearchAmount(convMatch[1]);
    const fromCurr = parseCurrencyToken(convMatch[2]);
    const toCurr = parseCurrencyToken(convMatch[3]);
    if (amount !== null && amount > 0 && fromCurr && toCurr) {
      return {
        intent: "exchange_rate",
        convertAmount: roundMoney2(amount),
        fromCurrency: fromCurr,
        toCurrency: toCurr,
      };
    }
  }

  // 2. Exchange rate inquiry: "tasa bcv", "precio del dolar", "tasa rmb", "a como esta el dolar"
  if (
    /\b(tasa\s+(?:de\s+)?bcv|dolar\s+bcv|tasa\s+del?\s+dia|tipo\s+de\s+cambio|precio\s+del?\s+dolar|(?:a\s+como|en\s+cuanto|cuanto)\s+esta\s+el\s+(?:dolar|bcv)|tasa\s+rmb|tasa\s+yuan|exchange\s+rate)\b/.test(
      folded,
    )
  ) {
    return { intent: "exchange_rate" };
  }

  // 3. Greetings & ERP How-To Help (evaluated early so "¿cómo emito una factura?" gives guide)
  if (
    /^(?:hola|buenos?\s+(?:dias|tardes|noches)|buenas(?:\s+(?:tardes|noches))?|hey|saludos|que\s+puedes\s+hacer|en\s+que\s+(?:me\s+)?(?:puedes\s+)?ayuda[rs]?|ayuda|help)\b/.test(
      folded,
    )
  ) {
    return { intent: "erp_help", helpTopic: "general" };
  }
  if (
    /\bcomo\s+(?:hago|hacer|realizo|realizar|abro|cierro|registrar?|subo|subir|importo|importar|creo|crear|emito|emitir|facturo|cobro)\b/.test(
      folded,
    )
  ) {
    let topic: CopilotHelpTopic = "general";
    if (/\bcierre\s+de\s+caja\b|\bcerrar\s+caja\b|\barqueo\b/.test(folded)) {
      topic = "cash_closure";
    } else if (/\bfactur|\bseniat\b|\bnota\s+de\s+credito\b/.test(folded)) {
      topic = "invoices_fiscal";
    } else if (
      /\bpago\b|\bcobro\b|\bpunto\s+de\s+venta\b|\bpos\b|\bzelle\b|\bpago\s+movil\b/.test(
        folded,
      )
    ) {
      topic = "pos_payments";
    } else if (
      /\bimporta|\bexcel\b|\bcatalogo\b|\bplantilla\b|\bpdf\b/.test(folded)
    ) {
      topic = "ai_imports";
    } else if (/\bcontenedor|\bpacking\s+list\b|\bembarque\b/.test(folded)) {
      topic = "containers";
    } else if (
      /\binventario\b|\bstock\b|\balmacen\b|\btraslado\b/.test(folded)
    ) {
      topic = "inventory";
    } else if (/\bpedido\b|\borden\b|\bcotizacion\b/.test(folded)) {
      topic = "orders_quotes";
    }
    return { intent: "erp_help", helpTopic: topic };
  }

  // 4. Cash closures / Arqueo de caja
  if (
    /\b(ultimo\s+cierre\s+de\s+caja|cierres?\s+de\s+caja|arqueos?\s+de\s+caja|como\s+estuvo\s+el\s+cierre|cuadre\s+de\s+caja)\b/.test(
      folded,
    )
  ) {
    return { intent: "cash_closure_status" };
  }

  // 5. Approvals & System Alerts
  if (
    /\b(aprobaciones?\s+(?:pendientes?|por\s+firmar)|solicitudes?\s+por\s+aprobar|que\s+falta\s+por\s+aprobar|alertas?\s+(?:activas?|del\s+sistema|pendientes?))\b/.test(
      folded,
    )
  ) {
    return { intent: "approvals_alerts_lookup" };
  }

  // 6. Vendor Commissions
  if (
    /\b(comisiones?\s+(?:de\s+vendedores|pendientes?|por\s+pagar|por\s+liquidar|liquidadas?)|mis\s+comisiones|cuanto\s+lleva\s+en\s+comisiones)\b/.test(
      folded,
    )
  ) {
    return { intent: "vendor_commissions_lookup" };
  }

  // 7. Top Selling Products
  if (
    /\b(productos?\s+mas\s+vendidos?|top\s+(?:de\s+)?productos|que\s+es\s+lo\s+que\s+mas\s+se\s+vende|articulos?\s+mas\s+vendidos?)\b/.test(
      folded,
    )
  ) {
    return {
      intent: "top_products",
      timeWindow: extractTimeWindow(folded) ?? "30d",
    };
  }

  // 8. Warehouses & Kardex Stock Movements
  if (
    /\b(que\s+almacenes\s+tenemos|inventario\s+por\s+almacen|stock\s+por\s+almacen|ultimos?\s+movimientos?\s+de\s+(?:inventario|stock|kardex)|movimientos?\s+de\s+kardex)\b/.test(
      folded,
    )
  ) {
    return { intent: "warehouse_stock_lookup" };
  }

  // 9. Suppliers Lookup
  const supplierMatch =
    /\b(?:busca(?:r)?\s+(?:al\s+)?proveedor|datos\s+del?\s+proveedor|ficha\s+del?\s+proveedor|productos?\s+del?\s+proveedor)\s+(.{2,60})$/.exec(
      folded,
    );
  if (supplierMatch?.[1]) {
    return {
      intent: "supplier_lookup",
      searchTerm: cleanEntitySubject(supplierMatch[1]),
    };
  }
  if (
    /\b(que\s+proveedores\s+tenemos|listado\s+de\s+proveedores)\b/.test(folded)
  ) {
    return { intent: "supplier_lookup" };
  }

  // 10. Credit Notes / Returns
  if (
    /\b(notas?\s+de\s+credito|ultima\s+nota\s+de\s+credito|nc[-\s]?\d+)\b/.test(
      folded,
    )
  ) {
    return {
      intent: "credit_note_lookup",
      documentNumber: docCode,
      searchTerm: extractSubjectAfterPreposition(folded),
    };
  }

  // 11. Delivery Notes / Dispatch Guides
  if (
    /\b(notas?\s+de\s+entrega|ultima\s+nota\s+de\s+entrega|guia\s+de\s+despacho|ne[-\s]?\d+)\b/.test(
      folded,
    )
  ) {
    return {
      intent: "delivery_note_lookup",
      documentNumber: docCode,
      searchTerm: extractSubjectAfterPreposition(folded),
    };
  }

  // 12. Overdue receivables (CxC vencidas / mora — checked BEFORE `invoice_lookup` so "facturas vencidas" stays AR!)
  if (
    /\b(facturas?\s+(?:estan\s+)?vencidas?|cuentas?\s+(?:por\s+cobrar\s+)?(?:estan\s+)?vencidas?|cxc\s+vencidas?|clientes?\s+(?:en\s+mora|morosos?|con\s+deuda\s+vencida)|deudas?\s+vencidas?|cartera\s+vencida|overdue\s+(?:receivables?|invoices?))\b/.test(
      folded,
    )
  ) {
    const subj = extractSubjectAfterPreposition(folded);
    return {
      intent: "overdue_receivables",
      minAmountUsd: extractNumericThresholdUsd(folded),
      ...(subj ? { searchTerm: subj } : {}),
    };
  }

  // 13. Invoices (`InternalInvoice` + SENIAT `FiscalDocument` + Payment Breakdown)
  if (
    /\b(ultima\s+factura|facturas?\s+(?:emitidas?|registradas?|fiscales?|de\s+hoy|de\s+esta\s+semana|de|del|para)|cual\s+fue\s+la\s+(?:ultima\s+)?factura|dame\s+la\s+factura|buscar?\s+(?:la\s+)?factura|numero\s+de\s+(?:factura|control)|libro\s+de\s+ventas|fac[-\s]?\d+|inv[-\s]?\d+)\b/.test(
      folded,
    )
  ) {
    return {
      intent: "invoice_lookup",
      latestOnly: /\bultima\b/.test(folded),
      documentNumber: docCode,
      searchTerm: extractSubjectAfterPreposition(folded),
      timeWindow: extractTimeWindow(folded),
    };
  }

  // 14. Payments / References / Methods ("¿cómo pagó X?", "último pago de X", "pagos por Zelle hoy")
  if (
    /\b(ultimo\s+(?:pago|cobro)|como\s+(?:nos\s+)?pago|con\s+que\s+pago|pagos?\s+(?:recibidos?|registrados?|validados?|por\s+validar|por\s+zelle|por\s+pago\s+movil|en\s+efectivo|por\s+transferencia|por\s+punto|de\s+hoy|de\s+esta\s+semana|de|del)|cobros?\s+(?:registrados?|de\s+hoy|por\s+zelle)|referencia\s+(?:de\s+pago\s+|bancaria\s+)?#?[a-z0-9-]+)\b/.test(
      folded,
    )
  ) {
    const howPaidMatch =
      /\b(?:como\s+(?:nos\s+)?pago|con\s+que\s+pago|ultimo\s+(?:pago|cobro)\s+(?:de|del))\s+(.{2,70})$/.exec(
        folded,
      );
    const refMatch =
      /\breferencia\s+(?:de\s+pago\s+|bancaria\s+)?#?([a-z0-9-]{3,32})\b/.exec(
        folded,
      );
    return {
      intent: "payment_lookup",
      paymentMethod: extractPaymentMethodFilter(folded),
      documentNumber: refMatch?.[1] ?? docCode,
      searchTerm:
        cleanEntitySubject(howPaidMatch?.[1]) ??
        extractSubjectAfterPreposition(folded),
      minAmountUsd: extractNumericThresholdUsd(folded),
      timeWindow: extractTimeWindow(folded),
    };
  }

  // 15. Low stock / Out of stock
  if (
    /\b(stock\s+(?:bajo|critico)|poco\s+stock|bajo\s+inventario|inventario\s+(?:critico|bajo)|low\s+stock|sin\s+stock|agotad[oa]s?|por\s+agotarse|stock\s+cero|out\s+of\s+stock|productos?\s+agotad[oa]s?|existencias?\s+criticas?)\b/.test(
      folded,
    )
  ) {
    const onlyOut =
      /\b(sin\s+stock|agotad[oa]s?|stock\s+cero|en\s+cero|out\s+of\s+stock)\b/.test(
        folded,
      );
    const termMatch =
      /\b(?:de|marca|categoria|tipo)\s+([a-z0-9\s-]{2,40})$/.exec(folded);
    const candidateTerm = termMatch?.[1]?.trim() ?? null;
    return {
      intent: "low_stock",
      onlyOutOfStock: onlyOut,
      searchTerm:
        candidateTerm &&
        !["stock", "inventario", "productos", "hoy", "cero"].includes(
          candidateTerm,
        )
          ? candidateTerm
          : null,
    };
  }

  // 16. Open / pending receivables (CxC abiertas)
  if (
    /\b(cuentas?\s+por\s+cobrar|cxc\s+(?:pendientes?|abiertas?)|saldos?\s+por\s+cobrar|clientes?\s+con\s+(?:saldo|deuda)|quien(?:es)?\s+(?:nos\s+)?deben?|tiene\s+(?:cuentas?\s+pendientes?|deuda\s+pendiente|saldo\s+pendiente))\b/.test(
      folded,
    )
  ) {
    const subj = extractSubjectAfterPreposition(folded);
    return {
      intent: "pending_receivables",
      minAmountUsd: extractNumericThresholdUsd(folded),
      ...(subj ? { searchTerm: subj } : {}),
    };
  }

  // 17. Unpaid orders
  if (
    /\b((?:pedidos?|ordenes?)\s+(?:(?:que\s+)?(?:tienen\s+saldo|siguen|estan)\s+)?(?:sin\s+pagar|impag[oa]s?|pendientes?\s+de\s+pago|por\s+cobrar|no\s+pagad[oa]s?)|unpaid\s+orders?)\b/.test(
      folded,
    )
  ) {
    const subj = extractSubjectAfterPreposition(folded);
    return {
      intent: "unpaid_orders",
      minAmountUsd: extractNumericThresholdUsd(folded),
      channel: extractChannelFilter(folded),
      timeWindow: extractTimeWindow(folded),
      ...(subj ? { searchTerm: subj } : {}),
    };
  }

  // 18. Pending / dispatch orders
  if (
    /\b((?:pedidos?|ordenes?)\s+(?:(?:que\s+)?(?:faltan|estan|siguen)\s+)?(?:pendientes?|por\s+despachar|por\s+aprobar|por\s+confirmar|de\s+hoy|de\s+(?:la|esta)\s+semana|activos?)|pending\s+orders?)\b/.test(
      folded,
    )
  ) {
    const subfilter = /\b(despachar|despacho|preparad[oa]s?)\b/.test(folded)
      ? "dispatch"
      : /\b(aprobar|confirmar|confirmacion)\b/.test(folded)
        ? "approval"
        : "all";
    const subj = extractSubjectAfterPreposition(folded);
    return {
      intent: "pending_orders",
      orderSubfilter: subfilter,
      channel: extractChannelFilter(folded),
      timeWindow: extractTimeWindow(folded),
      ...(subj ? { searchTerm: subj } : {}),
    };
  }

  // 19. Specific Order Detail / Last Purchase of a Customer
  if (
    /\b(ultimo\s+pedido|ultima\s+(?:compra|orden)|detalle\s+del?\s+(?:pedido|orden)|que\s+(?:nos\s+)?compro|que\s+(?:otros?\s+)?pedidos?\s+(?:nos\s+)?ha\s+hecho|que\s+mas\s+(?:nos\s+)?(?:ha\s+comprado|compro)|historial\s+de\s+(?:pedidos|compras)|ord[-\s]?\d+|ped[-\s]?\d+)\b/.test(
      folded,
    )
  ) {
    const whatBoughtMatch = /\bque\s+(?:nos\s+)?compro\s+(.{2,60})$/.exec(
      folded,
    );
    return {
      intent: "order_detail_lookup",
      latestOnly: /\bultim[oa]\b/.test(folded),
      documentNumber: docCode,
      searchTerm:
        cleanEntitySubject(whatBoughtMatch?.[1]) ??
        extractSubjectAfterPreposition(folded),
      channel: extractChannelFilter(folded),
      timeWindow: extractTimeWindow(folded),
    };
  }

  // 20. Open quotes
  if (
    /\b(ultima\s+cotizacion|cotizaciones?\s+(?:abiertas?|pendientes?|enviadas?|vigentes?|activas?|de|del|para)|presupuestos?\s+(?:abiertos?|pendientes?|vigentes?)|open\s+quotes?|cot[-\s]?\d+)\b/.test(
      folded,
    )
  ) {
    const subj = extractSubjectAfterPreposition(folded);
    return {
      intent: "open_quotes",
      timeWindow: extractTimeWindow(folded),
      ...(docCode ? { documentNumber: docCode } : {}),
      ...(subj ? { searchTerm: subj } : {}),
    };
  }

  // 21. Containers in transit / item in container
  const containerItemMatch =
    /\b(?:que\s+contenedor\s+(?:trae|tiene|incluye)|en\s+que\s+contenedor\s+(?:viene|llego|esta)n?)\s+(.{2,60})$/.exec(
      folded,
    );
  if (containerItemMatch?.[1]) {
    return {
      intent: "containers_status",
      searchTerm: containerItemMatch[1].replace(/[?¿!¡]+$/g, "").trim(),
    };
  }
  if (
    /\b(contenedores?\s+(?:(?:que\s+)?(?:vienen|estan)\s+)?(?:en\s+transito|activos?|proximos?|pendientes?|abiertos?|por\s+llegar)|importaciones?\s+en\s+transito|containers?\s+in\s+transit)\b/.test(
      folded,
    )
  ) {
    return { intent: "containers_status" };
  }

  // 22. Sales summary ("¿cuánto hemos vendido hoy / esta semana / este mes?", "cómo van las ventas")
  if (
    /\b(cuanto\s+(?:hemos\s+|se\s+ha\s+|llevamos\s+)?vendido|cuanto\s+vendimos|como\s+(?:van\s+las\s+ventas|vamos\s+(?:hoy\s+)?en\s+ventas)|total\s+(?:de\s+)?ventas|ventas\s+(?:de\s+hoy|del\s+dia|de\s+(?:la|esta)\s+semana|de\s+este\s+mes|del\s+mes|por\s+whatsapp|por\s+tienda|en\s+tienda|de\s+tienda|mercadolibre))\b/.test(
      folded,
    )
  ) {
    return {
      intent: "sales_summary",
      channel: extractChannelFilter(folded),
      timeWindow: extractTimeWindow(folded) ?? "today",
    };
  }

  // 23. Daily operational pulse ("¿cómo vamos hoy?", "resumen del día", "qué hay pendiente hoy")
  if (
    /\b(como\s+vamos(\s+hoy|\s+en\s+general)?|resumen\s+(?:de\s+hoy|del\s+dia|operativo|general)|que\s+hay\s+pendiente(\s+hoy)?|estado\s+del\s+negocio|pulso\s+del\s+dia)\b/.test(
      folded,
    )
  ) {
    return { intent: "daily_pulse", timeWindow: "today" };
  }

  // 24. Customer 360° lookup ("busca al cliente X", "todo sobre la empresa X", "cuánto nos debe X")
  const customerMatch =
    /\b(?:busca(?:r)?\s+(?:al\s+)?(?:cliente|empresa)|datos\s+del?\s+(?:cliente|empresa)|info(?:rmacion)?\s+del?\s+(?:cliente|empresa)|todo\s+sobre\s+(?:el\s+cliente|la\s+empresa)|que\s+(?:sabemos|tienes)\s+(?:de|del?\s+cliente|de\s+la\s+empresa)|ficha\s+(?:completa\s+)?(?:de|del?\s+cliente|de\s+la\s+empresa)|historial\s+del?\s+cliente|cuanto\s+(?:nos\s+)?debe\s+(?:el\s+cliente\s+|la\s+empresa\s+)?)\s+(.{2,60})$/.exec(
      folded,
    );
  if (customerMatch?.[1]) {
    const cleanedCust = cleanEntitySubject(customerMatch[1]);
    if (cleanedCust) {
      return { intent: "customer_lookup", searchTerm: cleanedCust };
    }
  }

  // 25. Direct or conversational price / availability / 360° question for a specific product
  const catalogMatch =
    /^(?:precio\s+de|a\s+como\s+(?:esta|sale|tenemos)|en\s+cuanto\s+sale|cuanto\s+cuesta|cuanto\s+vale|hay\s+stock\s+de|nos\s+queda(?:n)?|tenemos(?:\s+disponible)?|stock\s+de|disponibilidad\s+de|todo\s+sobre\s+el\s+producto)\s+(.{2,60})$/.exec(
      folded,
    );
  if (catalogMatch?.[1]) {
    return {
      intent: "catalog_lookup",
      searchTerm: catalogMatch[1]
        .replace(
          /\b(?:en\s+bolivares|en\s+bs|a\s+bcv|en\s+dolares|en\s+stock)\b/g,
          "",
        )
        .replace(/[?¿!¡]+$/g, "")
        .trim(),
    };
  }

  return null;
}

const CUSTOMER_SCOPED_INTENTS: ReadonlySet<QuickQueryIntent["intent"]> =
  new Set([
    "customer_lookup",
    "invoice_lookup",
    "order_detail_lookup",
    "payment_lookup",
    "delivery_note_lookup",
    "credit_note_lookup",
    "overdue_receivables",
    "pending_receivables",
    "pending_orders",
    "unpaid_orders",
    "open_quotes",
  ]);

function hasConflictingFollowUpDomain(
  folded: string,
  lastIntent: QuickQueryIntent["intent"],
): boolean {
  if (
    /\b(tasa|bcv|dolar(?:es)?|rmb|cny|yuan(?:es)?|bolivar(?:es)?|convierte|convertir|contenedor(?:es)?|embarque|packing|como\s+vamos|resumen\s+del\s+dia|pulso|como\s+(?:hago|cierro|abro|subo|importo|emito|facturo)|cierre\s+de\s+caja|arqueo|aprobaciones?|alertas?|comisiones?|almacenes?|proveedores?|hola|ayuda)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(cotizacion(?:es)?|presupuesto(?:s)?)\b/.test(folded) &&
    lastIntent !== "open_quotes"
  ) {
    return true;
  }
  if (
    /\b(cuenta(?:s)?|cxc|mora|vencid[oa]s?)\b/.test(folded) &&
    lastIntent !== "overdue_receivables" &&
    lastIntent !== "pending_receivables"
  ) {
    return true;
  }
  if (
    /\bfactura(?:s)?\b/.test(folded) &&
    lastIntent !== "invoice_lookup" &&
    lastIntent !== "overdue_receivables"
  ) {
    return true;
  }
  if (
    /\b(pago(?:s)?|cobro(?:s)?)\b/.test(folded) &&
    lastIntent !== "payment_lookup"
  ) {
    return true;
  }
  if (
    /\b(venta(?:s)?|vendido|vendimos)\b/.test(folded) &&
    lastIntent !== "sales_summary" &&
    lastIntent !== "top_products"
  ) {
    return true;
  }
  if (
    /\b(pedido(?:s)?|orden(?:es)?)\b/.test(folded) &&
    lastIntent !== "pending_orders" &&
    lastIntent !== "unpaid_orders" &&
    lastIntent !== "order_detail_lookup"
  ) {
    return true;
  }
  if (
    /\b(sin\s+pagar|impag[oa]s?|pendientes?\s+de\s+pago)\b/.test(folded) &&
    lastIntent !== "unpaid_orders"
  ) {
    return true;
  }
  if (
    /\b(stock|inventario|agotad[oa]s?|agotarse|existencias?)\b/.test(folded) &&
    lastIntent !== "low_stock"
  ) {
    return true;
  }
  if (/\bcliente(?:s)?\b/.test(folded) && lastIntent !== "customer_lookup") {
    return true;
  }
  return false;
}

/**
 * Resolves natural conversational follow-ups ("¿y solo los de WhatsApp?", "¿y cómo nos pagó?",
 * "¿tiene cuentas por cobrar vencidas?", "¿y mayores a 500?") against the previous turn
 * in <0.5ms without calling Gemini.
 */
export function resolveConversationalFollowUp(
  rawMessage: string,
  history: readonly CopilotHistoryTurn[],
): QuickQueryIntent | null {
  const lastTurn = history[history.length - 1];
  if (!lastTurn) return null;

  const folded = foldSearchText(rawMessage)
    .replace(/^[?¿!¡\s]+/, "")
    .replace(/[?¿!¡\s]+$/, "")
    .trim();
  if (folded.length < 2) return null;

  // Pattern A: Cross-module entity carryover when previous turn targeted a customer/company
  const carriedCustomer = lastTurn.searchTerm?.trim() ?? null;
  if (carriedCustomer && CUSTOMER_SCOPED_INTENTS.has(lastTurn.intent)) {
    const hasGlobalReset =
      /\b(en\s+general|todos\s+los\s+clientes|todas\s+las\s+empresas|todo\s+el\s+sistema|global)\b/.test(
        folded,
      );
    const hasReferentialCue =
      /^(?:y\b|tambien\b|ademas\b)/.test(folded) ||
      /\b(su|sus|ese\s+cliente|esa\s+empresa|este\s+cliente|esta\s+empresa|le\s+emitimos|nos\s+(?:debe|pago|compro|ha\s+(?:comprado|hecho|pagado))|tiene\s+(?:cuentas?|deuda|saldo|facturas?|pedidos?|cotizaciones?))\b/.test(
        folded,
      );

    if (!hasGlobalReset && hasReferentialCue) {
      const detNext = parseDeterministicQuickIntent(rawMessage);
      if (
        detNext &&
        CUSTOMER_SCOPED_INTENTS.has(detNext.intent) &&
        !detNext.searchTerm &&
        !detNext.documentNumber
      ) {
        return {
          ...detNext,
          searchTerm: carriedCustomer,
        };
      }
    }
  }

  if (hasConflictingFollowUpDomain(folded, lastTurn.intent)) {
    return null;
  }

  // Pattern B: Pure modifier follow-up when phrasing starts with conjunction/short modifier
  const looksLikeFollowUp =
    /^(?:y\b|solo\b|solamente\b|unicamente\b|pero\b|ahora\b|filtra(?:r)?\b|muestrame\s+solo\b|de\s+esos\b|cuales\b)/.test(
      folded,
    ) || folded.split(" ").length <= 4;

  if (!looksLikeFollowUp) return null;

  const nextChannel = extractChannelFilter(folded);
  const nextPayMethod = extractPaymentMethodFilter(folded);
  const nextWindow = extractTimeWindow(folded);
  const nextMinUsd = extractNumericThresholdUsd(folded);
  const wantsOnlyZero =
    /\b(en\s+cero|agotad[oa]s?|sin\s+stock|stock\s+0)\b/.test(folded);

  if (
    (lastTurn.intent === "pending_orders" ||
      lastTurn.intent === "unpaid_orders" ||
      lastTurn.intent === "sales_summary" ||
      lastTurn.intent === "open_quotes" ||
      lastTurn.intent === "invoice_lookup" ||
      lastTurn.intent === "order_detail_lookup" ||
      lastTurn.intent === "top_products") &&
    (nextChannel !== null || nextWindow !== null || nextMinUsd !== null)
  ) {
    return {
      intent: lastTurn.intent,
      orderSubfilter: lastTurn.orderSubfilter ?? null,
      channel: nextChannel ?? lastTurn.channel ?? null,
      timeWindow: nextWindow ?? lastTurn.timeWindow ?? null,
      minAmountUsd: nextMinUsd ?? lastTurn.minAmountUsd ?? null,
      searchTerm: lastTurn.searchTerm ?? null,
      documentNumber: lastTurn.documentNumber ?? null,
    };
  }

  if (
    lastTurn.intent === "payment_lookup" &&
    (nextPayMethod !== null || nextWindow !== null || nextMinUsd !== null)
  ) {
    return {
      intent: "payment_lookup",
      paymentMethod: nextPayMethod ?? lastTurn.paymentMethod ?? null,
      timeWindow: nextWindow ?? lastTurn.timeWindow ?? null,
      minAmountUsd: nextMinUsd ?? lastTurn.minAmountUsd ?? null,
      searchTerm: lastTurn.searchTerm ?? null,
      documentNumber: lastTurn.documentNumber ?? null,
    };
  }

  if (
    (lastTurn.intent === "overdue_receivables" ||
      lastTurn.intent === "pending_receivables") &&
    nextMinUsd !== null
  ) {
    return {
      intent: lastTurn.intent,
      minAmountUsd: nextMinUsd,
      searchTerm: lastTurn.searchTerm ?? null,
    };
  }

  if (lastTurn.intent === "low_stock" && wantsOnlyZero) {
    return {
      intent: "low_stock",
      onlyOutOfStock: true,
      searchTerm: lastTurn.searchTerm ?? null,
    };
  }

  return null;
}

// ──────────────────────────────────────────────
// TIER 2 STAGE B: `gemini-3.5-flash-lite` Zero-PII Intent Parser
// ──────────────────────────────────────────────

const QUICK_INTENT_SYSTEM_PROMPT = `Eres el planificador conversacional de intenciones de Cendaro ERP (mayorista y minorista).
NO tienes acceso a filas de la base de datos ni debes inventar cifras. Traduce el mensaje natural del usuario (tomando en cuenta los turnos previos si hace una repregunta como "¿y por WhatsApp?", "¿y cómo pagó?" o "¿y tiene cuentas vencidas?") a un objeto JSON válido con estas claves:
{
  "intent": "daily_pulse" | "sales_summary" | "top_products" | "invoice_lookup" | "order_detail_lookup" | "payment_lookup" | "delivery_note_lookup" | "credit_note_lookup" | "cash_closure_status" | "customer_lookup" | "supplier_lookup" | "warehouse_stock_lookup" | "vendor_commissions_lookup" | "approvals_alerts_lookup" | "erp_help" | "low_stock" | "overdue_receivables" | "pending_receivables" | "pending_orders" | "unpaid_orders" | "open_quotes" | "containers_status" | "exchange_rate" | "catalog_lookup",
  "searchTerm": string | null,
  "documentNumber": string | null,
  "latestOnly": boolean | null,
  "minAmountUsd": number | null,
  "onlyOutOfStock": boolean | null,
  "orderSubfilter": "approval" | "dispatch" | "all" | null,
  "channel": "store" | "mercadolibre" | "vendors" | "whatsapp" | "instagram" | null,
  "paymentMethod": "mobile_payment" | "transfer" | "cash" | "pos_terminal" | "zelle" | null,
  "timeWindow": "today" | "7d" | "30d" | "all" | null,
  "convertAmount": number | null,
  "fromCurrency": "usd" | "bs" | "rmb" | null,
  "toCurrency": "usd" | "bs" | "rmb" | null,
  "helpTopic": "general" | "pos_payments" | "cash_closure" | "ai_imports" | "orders_quotes" | "invoices_fiscal" | "inventory" | "containers" | null
}
Reglas:
- Saludos ("hola") o dudas de uso ("¿cómo emito una factura?", "¿cómo cierro caja?", "¿cómo subo un Excel?") -> "erp_help" + helpTopic.
- "¿Cómo vamos hoy?", "resumen del día" -> "daily_pulse".
- "¿Cuánto hemos vendido hoy/semana/mes?" -> "sales_summary".
- "Productos más vendidos", "top ventas" -> "top_products".
- Consultar última factura o facturas emitidas a una empresa/persona o número de factura/control -> "invoice_lookup" (pon empresa/cliente en searchTerm y código en documentNumber).
- Consultar último pedido/compra o qué compró un cliente o detalle de orden -> "order_detail_lookup".
- Consultar cómo pagó un cliente, último pago, cobros por Zelle/Pago Móvil/Efectivo o referencia bancaria -> "payment_lookup" (paymentMethod + searchTerm o referencia en documentNumber).
- Notas de entrega / guías de despacho -> "delivery_note_lookup".
- Notas de crédito / devoluciones -> "credit_note_lookup".
- Estado del último cierre o arqueo de caja -> "cash_closure_status".
- Ficha 360°, datos o cuánto nos debe un cliente -> "customer_lookup" (searchTerm).
- Proveedores -> "supplier_lookup".
- Almacenes o movimientos de kardex -> "warehouse_stock_lookup".
- Comisiones de vendedores -> "vendor_commissions_lookup".
- Aprobaciones pendientes o alertas activas -> "approvals_alerts_lookup".
- Cuentas/facturas vencidas o en mora -> "overdue_receivables".
- Cuentas por cobrar abiertas -> "pending_receivables".
- Productos agotados o stock bajo -> "low_stock" (agotado/cero -> onlyOutOfStock: true).
- Pedidos sin pagar -> "unpaid_orders". Pedidos por aprobar/despachar -> "pending_orders".
- Cotizaciones o presupuestos -> "open_quotes".
- Contenedores o embarques -> "containers_status".
- Tasa BCV, dólar, yuan/RMB o conversión -> "exchange_rate".
- Precio o disponibilidad de un producto -> "catalog_lookup" (searchTerm limpio).`;

// ──────────────────────────────────────────────
// TIER 2 STAGE C: Local Drizzle Executor (RLS + RBAC + Vendor Scope + 0% Cost Leak)
// ──────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 5;
const OPEN_AR_STATUSES = ["pending", "partial", "overdue"] as const;
const FISCAL_ID_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "rif_ve",
  "rif",
  "nif_cif_es",
  "rfc_mx",
  "ein_us",
]);

function buildWindowStartDate(
  window: QuickQueryTimeWindow | null | undefined,
): Date | null {
  if (!window || window === "all") return null;
  const now = new Date();
  if (window === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = window === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000);
}

function buildAccessDeniedResponse(
  query: string,
  intent: QuickQueryIntent["intent"],
  source: QuickAiQueryResponse["source"],
  moduleLabel: string,
  startedAt: number,
): QuickAiQueryResponse {
  return {
    query,
    intent,
    source,
    headline: "Acceso restringido por rol o plan",
    summary: `Tu rol actual no tiene permisos de lectura sobre ${moduleLabel} en este workspace.`,
    accessDenied: true,
    kpis: [],
    items: [],
    deepLink: null,
    latencyMs: Date.now() - startedAt,
  };
}

export async function executeQuickAiQuery(
  ctx: HybridSearchExecutionContext,
  input: QuickAiQueryInput,
  history: readonly CopilotHistoryTurn[] = [],
): Promise<
  QuickAiQueryResponse & {
    resolvedIntentObject?: QuickQueryIntent;
    guardrailBlocked?: boolean;
  }
> {
  const startedAt = Date.now();
  const { workspaceId, role } = ctx.workspace;
  const cleanedInput = input.q.replace(/^\?+\s*/, "").trim();
  const sanitized = sanitizeDocumentStructuralContent(cleanedInput).trim();
  let guardrailBlocked = false;

  if (sanitized.length < 2) {
    return {
      query: input.q,
      intent: "catalog_lookup",
      source: "degraded",
      headline: "Consulta demasiado corta",
      summary:
        "Escribe al menos 2 caracteres para ejecutar una consulta rápida.",
      kpis: [],
      items: [],
      deepLink: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Stage A: < 1ms deterministic follow-up merger + grammar (0 API calls)
  let parsedIntent =
    (history.length > 0
      ? resolveConversationalFollowUp(sanitized, history)
      : null) ?? parseDeterministicQuickIntent(sanitized);
  let source: QuickAiQueryResponse["source"] = "deterministic";

  // Stage B: `gemini-3.5-flash-lite` structured JSON fallback (0% cleartext PII/FOB on wire)
  if (!parsedIntent) {
    const recentTurnsSummary = history
      .slice(-4)
      .map((h, idx) => {
        const safeUser = maskSearchQueryForExternalAi(
          sanitizeDocumentStructuralContent(h.userText)
            .replace(/[\r\n]+/g, " ")
            .slice(0, 120),
          workspaceId,
        );
        const safeTerm = h.searchTerm
          ? maskSearchQueryForExternalAi(
              sanitizeDocumentStructuralContent(h.searchTerm)
                .replace(/[\r\n]+/g, " ")
                .slice(0, 80),
              workspaceId,
            )
          : "null";
        const safeDoc = h.documentNumber
          ? maskSearchQueryForExternalAi(
              sanitizeDocumentStructuralContent(h.documentNumber)
                .replace(/[\r\n]+/g, " ")
                .slice(0, 48),
              workspaceId,
            )
          : "null";
        return `T${idx + 1}: user="${safeUser}" -> intent=${h.intent}, subfilter=${h.orderSubfilter ?? "null"}, channel=${h.channel ?? "null"}, pay=${h.paymentMethod ?? "null"}, window=${h.timeWindow ?? "null"}, doc=${safeDoc}, term=${safeTerm}`;
      })
      .join("\n");

    const contextualPromptInput =
      recentTurnsSummary.length > 0
        ? `Contexto previo de conversación:\n${recentTurnsSummary}\n\nMensaje actual del usuario:\n${sanitized}`
        : sanitized;

    const guardrailDecision =
      process.env.ENABLE_RAG_GUARDRAILS === "false"
        ? { passed: true, score: 0 }
        : evaluateInputGuardrails(contextualPromptInput);

    const queueGuardrailAudit = (reason?: string, score?: number) => {
      const maskedForAudit = maskSearchQueryForExternalAi(
        contextualPromptInput.slice(0, 360),
        workspaceId,
      );
      ctx.afterCommit.push((poolDb) =>
        persistSearchAuditEvent(poolDb, workspaceId, {
          workspaceId,
          userId: ctx.user.id,
          operationType: "guardrail_violation",
          queryText: maskedForAudit,
          latencyMs: Date.now() - startedAt,
          metadata: {
            tier: "quick_ai_query",
            reason: reason ?? "PROMPT_INJECTION_DETECTED",
            score: score ?? 1,
          },
        }),
      );
    };

    if (guardrailDecision.passed) {
      const currentMsgVault = tokenizeAndVaultContent(
        sanitized,
        workspaceId,
        "query-ephemeral",
        { skipTypes: buildSearchQuerySkipPiiSet(sanitized) },
      );
      const fiscalMatches = currentMsgVault.vaultEntries.filter((v) =>
        FISCAL_ID_ENTITY_TYPES.has(v.entityType),
      );
      const singleFiscalId =
        fiscalMatches.length === 1
          ? fiscalMatches[0]?.cleartextValue
          : undefined;

      const maskedForCache = foldSearchText(
        maskSearchQueryForExternalAi(contextualPromptInput, workspaceId),
      );
      const cacheKey = sha256Hex(`${workspaceId}|${maskedForCache}`);
      const cached = intentParseCache.get(cacheKey);
      if (cached) {
        parsedIntent = { ...cached };
        source = "cache";
      } else if (isGenerativeAiConfigured()) {
        const budget = await consumeSearchLlmBudget(ctx.user.id, workspaceId);
        if (budget.allowed) {
          try {
            const aiRes = await generateStructuredJson({
              workspaceId,
              userId: ctx.user.id,
              operationLabel: "quick_search_intent",
              systemInstruction: QUICK_INTENT_SYSTEM_PROMPT,
              untrustedUserText: contextualPromptInput,
              zodSchema: quickQueryIntentSchema,
              omitResponseSchema: true,
              maxOutputTokens: 200,
              timeoutMs: 3_800,
              candidateModelsOverride: ["gemini-3.5-flash-lite"],
              maxAttemptsPerModel: 1,
              skipPiiTypes: buildSearchQuerySkipPiiSet(contextualPromptInput),
              poolDb: ctx.db,
            });
            intentParseCache.set(cacheKey, aiRes.data);
            parsedIntent = { ...aiRes.data };
            source =
              aiRes.provider === "gemini" ? "gemini-flash-lite" : "degraded";
          } catch (err) {
            if (err instanceof RagGuardrailViolationError) {
              guardrailBlocked = true;
              queueGuardrailAudit(err.reason, err.score);
            }
            source = "degraded";
          }
        } else {
          source = "degraded";
        }
      } else {
        source = "degraded";
      }

      // Ephemeral RAM-only fiscal ID rehydration when the user typed a RIF/Cédula in `sanitized`
      if (parsedIntent && singleFiscalId) {
        const foldedMaskedMsg = foldSearchText(
          currentMsgVault.sanitizedContent,
        );
        const aiTerm = parsedIntent.searchTerm?.trim() ?? "";
        const isGroundedNonPiiTerm =
          aiTerm.length >= 2 &&
          !aiTerm.includes("[CONFIDENCIAL]") &&
          !/\b(?:pii|conf)_/i.test(aiTerm) &&
          foldedMaskedMsg.includes(foldSearchText(aiTerm));

        if (
          aiTerm.includes("[CONFIDENCIAL]") ||
          (!isGroundedNonPiiTerm &&
            CUSTOMER_SCOPED_INTENTS.has(parsedIntent.intent))
        ) {
          parsedIntent.searchTerm = singleFiscalId;
        }
        if (
          parsedIntent.documentNumber?.includes("[CONFIDENCIAL]") ||
          /\b(?:pii|conf)_/i.test(parsedIntent.documentNumber ?? "")
        ) {
          parsedIntent.documentNumber = singleFiscalId;
        }
      }
    } else {
      guardrailBlocked = true;
      queueGuardrailAudit(guardrailDecision.reason, guardrailDecision.score);
      source = "degraded";
    }

    parsedIntent ??= {
      intent: "catalog_lookup",
      searchTerm: sanitized.slice(0, 120),
    };
  }

  const activeIntent = parsedIntent;
  const vendorId = vendorScopeId(ctx);

  // Stage C: Pre-Transaction Role & Plan Module Authorization Gates
  switch (activeIntent.intent) {
    case "low_stock":
    case "warehouse_stock_lookup": {
      if (
        !can(role, "inventory", "read") ||
        !(await isModuleEnabled(ctx, "inventory"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Inventario y Almacenes",
          startedAt,
        );
      }
      break;
    }
    case "overdue_receivables":
    case "pending_receivables": {
      if (
        !can(role, "receivables", "read") ||
        !(await isModuleEnabled(ctx, "receivables"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Cuentas por Cobrar (CxC)",
          startedAt,
        );
      }
      break;
    }
    case "sales_summary":
    case "top_products":
    case "invoice_lookup":
    case "order_detail_lookup":
    case "delivery_note_lookup":
    case "credit_note_lookup":
    case "pending_orders":
    case "unpaid_orders":
    case "open_quotes": {
      if (
        !can(role, "orders", "read") ||
        !(await isModuleEnabled(ctx, "orders"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Facturas, Pedidos y Ventas",
          startedAt,
        );
      }
      break;
    }
    case "payment_lookup": {
      if (
        !can(role, "payments", "read") ||
        !(await isModuleEnabled(ctx, "payments"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Pagos y Cobros",
          startedAt,
        );
      }
      break;
    }
    case "cash_closure_status": {
      if (
        !can(role, "cash_closure", "read") ||
        !(await isModuleEnabled(ctx, "cash_closure"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Cierre y Arqueo de Caja",
          startedAt,
        );
      }
      break;
    }
    case "customer_lookup": {
      if (
        !can(role, "customers", "read") ||
        !(await isModuleEnabled(ctx, "customers"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Directorio de Clientes",
          startedAt,
        );
      }
      break;
    }
    case "containers_status": {
      if (
        !can(role, "containers", "read") ||
        !(await isModuleEnabled(ctx, "containers"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Contenedores e Importaciones",
          startedAt,
        );
      }
      break;
    }
    case "catalog_lookup":
    case "supplier_lookup": {
      if (
        !can(role, "catalog", "read") ||
        !(await isModuleEnabled(ctx, "catalog"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Catálogo y Proveedores",
          startedAt,
        );
      }
      break;
    }
    case "vendor_commissions_lookup": {
      if (
        !can(role, "vendors", "read") ||
        !(await isModuleEnabled(ctx, "vendors"))
      ) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Comisiones de Vendedores",
          startedAt,
        );
      }
      break;
    }
    case "approvals_alerts_lookup": {
      if (!can(role, "dashboard", "update")) {
        return buildAccessDeniedResponse(
          input.q,
          activeIntent.intent,
          source,
          "Aprobaciones y Alertas Operativas",
          startedAt,
        );
      }
      break;
    }
    case "daily_pulse":
    case "erp_help":
    case "exchange_rate": {
      // Role-scoped internally so every active workspace member gets tailored answers
      break;
    }
  }

  const canNavigateInventoryPage =
    can(role, "inventory", "update") &&
    (await isModuleEnabled(ctx, "inventory"));
  const canReadInventoryStock =
    can(role, "inventory", "read") && (await isModuleEnabled(ctx, "inventory"));
  const canReadOrdersPulse =
    can(role, "orders", "read") && (await isModuleEnabled(ctx, "orders"));
  const canApproveOrders = can(role, "orders", "approve") && canReadOrdersPulse;
  const canReadPaymentsPulse =
    can(role, "payments", "read") && (await isModuleEnabled(ctx, "payments"));
  const canReadReceivablesPulse =
    can(role, "receivables", "read") &&
    (await isModuleEnabled(ctx, "receivables"));
  const canReadCustomersPulse =
    can(role, "customers", "read") && (await isModuleEnabled(ctx, "customers"));
  const canReadContainersPulse =
    can(role, "containers", "read") &&
    (await isModuleEnabled(ctx, "containers"));
  const canReadCatalogPulse =
    can(role, "catalog", "read") && (await isModuleEnabled(ctx, "catalog"));
  const canReadPricingPulse =
    can(role, "pricing", "read") && (await isModuleEnabled(ctx, "pricing"));
  const canApproveVendors =
    can(role, "vendors", "approve") && (await isModuleEnabled(ctx, "vendors"));
  const canImportCatalogPulse =
    can(role, "catalog", "create") && canReadCatalogPulse;
  const canPosPulse =
    can(role, "pos", "read") && (await isModuleEnabled(ctx, "pos"));
  const canCashClosurePulse =
    can(role, "cash_closure", "read") &&
    (await isModuleEnabled(ctx, "cash_closure"));
  const canReadRatesPage =
    can(role, "rates", "read") && (await isModuleEnabled(ctx, "rates"));

  const rawRes = await runReadonlyIfSupported<QuickAiQueryResponse>(
    ctx.db,
    workspaceId,
    async (tx): Promise<QuickAiQueryResponse> => {
      const domainEnv = {
        tx,
        workspaceId,
        query: input.q,
        sanitized,
        intent: activeIntent,
        source,
        startedAt,
        vendorId,
        canReadOrders: canReadOrdersPulse,
        canApproveOrders,
        canReadPayments: canReadPaymentsPulse,
        canReadReceivables: canReadReceivablesPulse,
        canReadCustomers: canReadCustomersPulse,
        canReadCatalog: canReadCatalogPulse,
        canReadPricing: canReadPricingPulse,
        canReadInventoryStock,
        canNavigateInventoryPage,
        canApproveVendors,
      };

      switch (activeIntent.intent) {
        case "invoice_lookup":
          return executeInvoiceLookup(domainEnv);
        case "order_detail_lookup":
          return executeOrderDetailLookup(domainEnv);
        case "payment_lookup":
          return executePaymentLookup(domainEnv);
        case "delivery_note_lookup":
          return executeDeliveryNoteLookup(domainEnv);
        case "credit_note_lookup":
          return executeCreditNoteLookup(domainEnv);
        case "cash_closure_status":
          return executeCashClosureStatus(domainEnv);
        case "customer_lookup":
          return executeCustomerDossierLookup(domainEnv);
        case "catalog_lookup":
          return executeProductDossierLookup(domainEnv);
        case "supplier_lookup":
          return executeSupplierLookup(domainEnv);
        case "warehouse_stock_lookup":
          return executeWarehouseStockLookup(domainEnv);
        case "vendor_commissions_lookup":
          return executeVendorCommissionsLookup(domainEnv);
        case "approvals_alerts_lookup":
          return executeApprovalsAlertsLookup(domainEnv);
        case "top_products":
          return executeTopProductsLookup(domainEnv);

        case "erp_help": {
          const topic = activeIntent.helpTopic ?? "general";
          if (topic === "invoices_fiscal") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Facturación Interna y Fiscal SENIAT",
              summary:
                "Cada pedido confirmado puede generar su Factura Interna, Nota de Entrega, Documento Fiscal SENIAT (con número de control y tasa BCV) o Nota de Crédito con trazabilidad de cobros.",
              kpis: [],
              items: [],
              deepLink: canApproveOrders
                ? { label: "Abrir Facturas", href: "/invoices" }
                : canReadOrdersPulse
                  ? { label: "Ver Pedidos", href: "/orders" }
                  : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "cash_closure") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Cierre y Arqueo de Caja",
              summary:
                "En Cierre de Caja puedes conciliar efectivo USD, Bolívares, Pago Móvil, Punto y Zelle contra las ventas del turno y registrar diferencias automáticamente.",
              kpis: [],
              items: [],
              deepLink: canCashClosurePulse
                ? { label: "Ir a Cierre de Caja", href: "/cash-closure" }
                : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "pos_payments") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Punto de Venta y Registro de Pagos",
              summary:
                "Desde Punto de Venta (POS) o desde el detalle de cualquier pedido puedes cobrar en multimoneda (USD, Pago Móvil, Transferencia, Zelle o Punto) aplicando tasa BCV vigente.",
              kpis: [],
              items: [],
              deepLink: canPosPulse
                ? { label: "Abrir Punto de Venta", href: "/pos" }
                : canReadOrdersPulse
                  ? { label: "Ver Pedidos", href: "/orders" }
                  : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "ai_imports") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Importación Inteligente sin Plantilla",
              summary:
                "Puedes subir archivos Excel (.xlsx/.xls), CSV o PDF de proveedores en español, inglés o mandarín sin usar plantilla fija: el sistema detecta columnas, autogenera SKUs faltantes y evita duplicados semánticos.",
              kpis: [],
              items: [],
              deepLink: canImportCatalogPulse
                ? { label: "Importar Catálogo con IA", href: "/catalog/import" }
                : canReadCatalogPulse
                  ? { label: "Abrir Catálogo", href: "/catalog" }
                  : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "containers") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Contenedores y Packing Lists",
              summary:
                "En Contenedores puedes cargar múltiples archivos de Packing List y Factura Comercial, conciliar ítems con el catálogo y consultar qué mercancía viene en tránsito.",
              kpis: [],
              items: [],
              deepLink: canReadContainersPulse
                ? { label: "Abrir Contenedores", href: "/containers" }
                : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "inventory") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Inventario y Control de Stock",
              summary:
                "En Inventario y Catálogo puedes consultar existencias en tiempo real por producto, registrar entradas o ajustes con trazabilidad en el kardex y detectar productos en nivel crítico.",
              kpis: [],
              items: [],
              deepLink: canNavigateInventoryPage
                ? { label: "Abrir Inventario", href: "/inventory" }
                : canReadCatalogPulse
                  ? { label: "Abrir Catálogo", href: "/catalog" }
                  : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          if (topic === "orders_quotes") {
            return {
              query: input.q,
              intent: "erp_help" as const,
              source,
              headline: "Guía rápida: Pedidos y Cotizaciones",
              summary:
                "En Ventas puedes emitir cotizaciones multimoneda, convertirlas en pedidos con un clic, gestionar aprobaciones y despachos por canal y registrar cobros parciales o totales.",
              kpis: [],
              items: [],
              deepLink: canReadOrdersPulse
                ? { label: "Abrir Pedidos", href: "/orders" }
                : null,
              latencyMs: Date.now() - startedAt,
            };
          }
          const isMgmt = canReadReceivablesPulse;
          return {
            query: input.q,
            intent: "erp_help" as const,
            source,
            headline: "Asistente Conversacional Cendaro",
            summary: isMgmt
              ? "Hola. Puedo consultar en segundos cualquier factura (interna o SENIAT), cómo y cuándo pagó un cliente, pedidos, cotizaciones, cierres de caja, existencias por almacén, comisiones, contenedores y cuentas por cobrar."
              : "Hola. Puedes preguntarme con total normalidad cuál fue la última factura o pedido de un cliente, cómo pagó, si nos queda stock de un producto, precios en USD/Bs (BCV) o tus cotizaciones.",
            kpis: [],
            items: [],
            deepLink: null,
            latencyMs: Date.now() - startedAt,
          };
        }

        case "daily_pulse": {
          const startOfToday = buildWindowStartDate("today") ?? new Date();
          const bcvRow = await tx
            .select({ rate: ExchangeRate.rate })
            .from(ExchangeRate)
            .where(
              and(
                eq(ExchangeRate.workspaceId, workspaceId),
                eq(ExchangeRate.rateType, "bcv"),
              ),
            )
            .orderBy(desc(ExchangeRate.createdAt))
            .limit(1);
          const bcv =
            Number(bcvRow[0]?.rate ?? 0) > 0 ? Number(bcvRow[0]?.rate) : null;

          const kpis: QuickQueryKpi[] = [];
          const highlights: string[] = [];

          if (canReadOrdersPulse) {
            const todayOrderAgg = await tx
              .select({
                orderCount: sql<number>`COUNT(*)::int`,
                totalSum: sql<string>`COALESCE(SUM(${SalesOrder.total}), 0)`,
              })
              .from(SalesOrder)
              .where(
                and(
                  eq(SalesOrder.workspaceId, workspaceId),
                  vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
                  gt(SalesOrder.createdAt, startOfToday),
                  sql`${SalesOrder.status} NOT IN ('cancelled', 'returned')`,
                ),
              );

            const todayCount = Number(todayOrderAgg[0]?.orderCount ?? 0);
            const todayUsd = roundMoney2(
              Number(todayOrderAgg[0]?.totalSum ?? 0),
            );
            kpis.push({
              label: "Ventas hoy",
              value: `${formatUsd(todayUsd)} (${todayCount})`,
              tone: todayCount > 0 ? "success" : "neutral",
            });
            highlights.push(
              `Hoy van ${todayCount} pedidos activos por ${formatUsd(todayUsd)}${bcv ? ` (${formatBs(convertUsdToVes(todayUsd, bcv))})` : ""}`,
            );

            const pendingAgg = await tx
              .select({
                pendingCount: sql<number>`COUNT(*)::int`,
              })
              .from(SalesOrder)
              .where(
                and(
                  eq(SalesOrder.workspaceId, workspaceId),
                  vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
                  inArray(SalesOrder.status, [
                    "pending",
                    "pending_confirmation",
                    "confirmed",
                    "prepared",
                  ]),
                ),
              );
            const pendingCount = Number(pendingAgg[0]?.pendingCount ?? 0);
            kpis.push({
              label: "Pedidos por atender",
              value: String(pendingCount),
              tone: pendingCount > 0 ? "warning" : "neutral",
            });
            if (pendingCount > 0) {
              highlights.push(
                `${pendingCount} pedidos pendientes de aprobación o despacho`,
              );
            }
          }

          if (canReadInventoryStock) {
            const stockSumExpr = sql<number>`COALESCE(SUM(${StockLedger.quantity}), 0)::int`;
            const lowRows = await tx
              .select({ id: Product.id, qty: stockSumExpr })
              .from(Product)
              .leftJoin(
                StockLedger,
                and(
                  eq(StockLedger.productId, Product.id),
                  eq(StockLedger.workspaceId, workspaceId),
                ),
              )
              .where(
                and(
                  eq(Product.workspaceId, workspaceId),
                  eq(Product.status, "active"),
                ),
              )
              .groupBy(Product.id)
              .having(lte(stockSumExpr, LOW_STOCK_THRESHOLD))
              .limit(30);
            kpis.push({
              label: "Stock crítico",
              value: `${lowRows.length}${lowRows.length === 30 ? "+" : ""}`,
              tone: lowRows.length > 0 ? "warning" : "success",
            });
            if (lowRows.length > 0) {
              highlights.push(
                `${lowRows.length} productos con existencias críticas (<= 5 unid.)`,
              );
            }
          }

          if (canReadReceivablesPulse) {
            const now = new Date();
            const overdueAgg = await tx
              .select({
                overdueCount: sql<number>`COUNT(*)::int`,
                overdueSum: sql<string>`COALESCE(SUM(${AccountReceivable.balance}), 0)`,
              })
              .from(AccountReceivable)
              .where(
                and(
                  eq(AccountReceivable.workspaceId, workspaceId),
                  inArray(AccountReceivable.status, [...OPEN_AR_STATUSES]),
                  gt(AccountReceivable.balance, 0),
                  lte(AccountReceivable.dueDate, now),
                ),
              );
            const overdueCount = Number(overdueAgg[0]?.overdueCount ?? 0);
            const overdueSum = roundMoney2(
              Number(overdueAgg[0]?.overdueSum ?? 0),
            );
            kpis.push({
              label: "CxC vencidas",
              value: formatUsd(overdueSum),
              tone: overdueSum > 0 ? "destructive" : "success",
            });
            if (overdueCount > 0) {
              highlights.push(
                `${overdueCount} cuentas vencidas suman ${formatUsd(overdueSum)}`,
              );
            }
          }

          if (bcv) {
            kpis.push({
              label: "Tasa BCV",
              value: `Bs. ${roundMoney4(bcv)}`,
              tone: "info",
            });
          }

          return {
            query: input.q,
            intent: "daily_pulse" as const,
            source,
            headline: "Pulso operativo en tiempo real",
            summary:
              highlights.length > 0
                ? `${highlights.join("; ")}.`
                : "Operación al día sin alertas pendientes en este momento.",
            kpis,
            items: [],
            deepLink: { label: "Abrir Panel Principal", href: "/dashboard" },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "sales_summary": {
          const win = activeIntent.timeWindow ?? "today";
          const sinceDate = buildWindowStartDate(win);
          const CHANNEL_LABEL: Record<string, string> = {
            store: "Tienda",
            mercadolibre: "MercadoLibre",
            vendors: "Vendedores",
            whatsapp: "WhatsApp",
            instagram: "Instagram",
          };
          const WINDOW_LABEL: Record<string, string> = {
            today: "hoy",
            "7d": "los últimos 7 días",
            "30d": "los últimos 30 días",
            all: "el histórico",
          };

          const bcvRow = await tx
            .select({ rate: ExchangeRate.rate })
            .from(ExchangeRate)
            .where(
              and(
                eq(ExchangeRate.workspaceId, workspaceId),
                eq(ExchangeRate.rateType, "bcv"),
              ),
            )
            .orderBy(desc(ExchangeRate.createdAt))
            .limit(1);
          const bcv =
            Number(bcvRow[0]?.rate ?? 0) > 0 ? Number(bcvRow[0]?.rate) : null;

          const salesWhere = and(
            eq(SalesOrder.workspaceId, workspaceId),
            vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
            activeIntent.channel
              ? eq(SalesOrder.channel, activeIntent.channel)
              : undefined,
            sinceDate ? gt(SalesOrder.createdAt, sinceDate) : undefined,
            sql`${SalesOrder.status} NOT IN ('cancelled', 'returned')`,
          );

          const salesAgg = await tx
            .select({
              orderCount: sql<number>`COUNT(*)::int`,
              totalSum: sql<string>`COALESCE(SUM(${SalesOrder.total}), 0)`,
            })
            .from(SalesOrder)
            .where(salesWhere);

          const rows = await tx
            .select({
              id: SalesOrder.id,
              orderNumber: SalesOrder.orderNumber,
              channel: SalesOrder.channel,
              total: SalesOrder.total,
              customerName: Customer.name,
            })
            .from(SalesOrder)
            .leftJoin(
              Customer,
              and(
                eq(SalesOrder.customerId, Customer.id),
                eq(Customer.workspaceId, workspaceId),
              ),
            )
            .where(salesWhere)
            .orderBy(desc(SalesOrder.createdAt))
            .limit(5);

          const orderCount = Number(salesAgg[0]?.orderCount ?? 0);
          const totalUsd = roundMoney2(Number(salesAgg[0]?.totalSum ?? 0));
          const avgUsd =
            orderCount > 0 ? roundMoney2(totalUsd / orderCount) : 0;
          const chanText = activeIntent.channel
            ? ` por ${CHANNEL_LABEL[activeIntent.channel] ?? activeIntent.channel}`
            : "";
          const winText = WINDOW_LABEL[win] ?? "el período";

          const kpis: QuickQueryKpi[] = [
            {
              label: "Ventas USD",
              value: formatUsd(totalUsd),
              tone: totalUsd > 0 ? "success" : "neutral",
            },
            {
              label: "Órdenes",
              value: String(orderCount),
              tone: "info",
            },
            {
              label: bcv ? "Equivalente BCV" : "Ticket prom.",
              value: bcv
                ? formatBs(convertUsdToVes(totalUsd, bcv))
                : formatUsd(avgUsd),
              tone: "neutral",
            },
          ];

          return {
            query: input.q,
            intent: "sales_summary" as const,
            source,
            headline: `Resumen de ventas (${winText}${chanText})`,
            summary:
              orderCount === 0
                ? `Aún no se registran órdenes activas en ${winText}${chanText}.`
                : `Se han registrado ${orderCount} órdenes en ${winText}${chanText} por ${formatUsd(totalUsd)}${bcv ? ` (${formatBs(convertUsdToVes(totalUsd, bcv))} a tasa BCV)` : ""}, con ticket promedio de ${formatUsd(avgUsd)}.`,
            kpis,
            items: rows.map((r) => ({
              id: r.id,
              title: `Orden ${r.orderNumber}`,
              subtitle: `${r.customerName ?? "Consumidor"} · ${CHANNEL_LABEL[r.channel] ?? r.channel}`,
              badgeText: formatUsd(Number(r.total)),
              badgeTone: "success",
              href: `/orders/${r.id}`,
            })),
            deepLink: {
              label: "Ver órdenes de venta",
              href: activeIntent.channel
                ? `/orders?channel=${activeIntent.channel}`
                : "/orders",
            },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "exchange_rate": {
          const bcvRows = await tx
            .select({
              rateType: ExchangeRate.rateType,
              rate: ExchangeRate.rate,
            })
            .from(ExchangeRate)
            .where(
              and(
                eq(ExchangeRate.workspaceId, workspaceId),
                eq(ExchangeRate.rateType, "bcv"),
              ),
            )
            .orderBy(desc(ExchangeRate.createdAt))
            .limit(1);

          const rmbRows = await tx
            .select({
              rateType: ExchangeRate.rateType,
              rate: ExchangeRate.rate,
            })
            .from(ExchangeRate)
            .where(
              and(
                eq(ExchangeRate.workspaceId, workspaceId),
                eq(ExchangeRate.rateType, "rmb_usd"),
              ),
            )
            .orderBy(desc(ExchangeRate.createdAt))
            .limit(1);

          const rawBcv = Number(bcvRows[0]?.rate ?? 0);
          const rawRmb = Number(rmbRows[0]?.rate ?? 0);
          const bcv = rawBcv > 0 ? rawBcv : null;
          const rmbUsd = rawRmb > 0 ? rawRmb : null;

          const kpis: QuickQueryKpi[] = [
            {
              label: "Tasa BCV (USD/Bs)",
              value: bcv ? `Bs. ${roundMoney4(bcv)}` : "Sin registro",
              tone: bcv ? "info" : "neutral",
            },
            {
              label: "Tasa RMB/USD",
              value: rmbUsd ? `¥ ${roundMoney4(rmbUsd)}` : "Sin registro",
              tone: "neutral",
            },
          ];

          let summary = bcv
            ? `Tasa oficial BCV activa: Bs. ${roundMoney4(bcv)} por USD.`
            : "Aún no hay una tasa BCV registrada en este workspace.";

          if (
            activeIntent.convertAmount &&
            activeIntent.fromCurrency &&
            activeIntent.toCurrency
          ) {
            const amt = activeIntent.convertAmount;
            const from = activeIntent.fromCurrency;
            const to = activeIntent.toCurrency;
            let usdEquivalent: number | null = null;
            if (from === "usd") usdEquivalent = amt;
            else if (from === "bs" && bcv && bcv > 0) {
              usdEquivalent = convertVesToUsd(amt, bcv);
            } else if (from === "rmb" && rmbUsd && rmbUsd > 0) {
              usdEquivalent = roundMoney2(amt / rmbUsd);
            }

            let converted: number | null = null;
            if (usdEquivalent !== null) {
              if (to === "usd") converted = usdEquivalent;
              else if (to === "bs" && bcv && bcv > 0) {
                converted = convertUsdToVes(usdEquivalent, bcv);
              } else if (to === "rmb" && rmbUsd && rmbUsd > 0) {
                converted = multiplyMoney(usdEquivalent, rmbUsd);
              }
            }

            if (converted !== null) {
              const formattedTarget =
                to === "usd"
                  ? formatUsd(converted)
                  : to === "bs"
                    ? formatBs(converted)
                    : `¥ ${roundMoney2(converted)}`;
              kpis.unshift({
                label: `Conversión (${from.toUpperCase()} → ${to.toUpperCase()})`,
                value: formattedTarget,
                tone: "success",
              });
              summary = `${amt} ${from.toUpperCase()} equivalen a ${formattedTarget} con las tasas vigentes del workspace.`;
            }
          }

          return {
            query: input.q,
            intent: "exchange_rate",
            source,
            headline: "Tasas de cambio y conversión rápida",
            summary,
            kpis,
            items: [],
            deepLink: canReadRatesPage
              ? { label: "Abrir panel de tasas", href: "/rates" }
              : null,
            latencyMs: Date.now() - startedAt,
          };
        }

        case "low_stock": {
          const stockSumExpr = sql<number>`COALESCE(SUM(${StockLedger.quantity}), 0)::int`;
          const foldedTerm = activeIntent.searchTerm
            ? foldSearchText(activeIntent.searchTerm)
            : null;
          const escapedPattern = foldedTerm
            ? `%${escapeLikeSql(foldedTerm)}%`
            : null;
          const termFilter = escapedPattern
            ? sql`(translate(lower(${Product.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedPattern} OR lower(${Product.sku}) LIKE ${escapedPattern})`
            : undefined;

          const threshold = activeIntent.onlyOutOfStock
            ? 0
            : LOW_STOCK_THRESHOLD;
          const rows = await tx
            .select({
              id: Product.id,
              sku: Product.sku,
              name: Product.name,
              totalStock: stockSumExpr,
            })
            .from(Product)
            .leftJoin(
              StockLedger,
              and(
                eq(StockLedger.productId, Product.id),
                eq(StockLedger.workspaceId, workspaceId),
              ),
            )
            .where(
              and(
                eq(Product.workspaceId, workspaceId),
                eq(Product.status, "active"),
                termFilter,
              ),
            )
            .groupBy(Product.id, Product.sku, Product.name)
            .having(lte(stockSumExpr, threshold))
            .orderBy(asc(stockSumExpr), asc(Product.name))
            .limit(25);

          let outCount = 0;
          let lowCount = 0;
          for (const r of rows) {
            if (Number(r.totalStock) <= 0) outCount++;
            else lowCount++;
          }

          const topItems: QuickQueryResultRow[] = rows.slice(0, 5).map((r) => {
            const qty = Number(r.totalStock);
            return {
              id: r.id,
              title: r.name,
              subtitle: `SKU ${r.sku}`,
              badgeText: qty <= 0 ? "Agotado (0)" : `Stock bajo (${qty})`,
              badgeTone: qty <= 0 ? "destructive" : "warning",
              href: `/catalog/${r.id}`,
            };
          });

          return {
            query: input.q,
            intent: "low_stock",
            source,
            headline: activeIntent.onlyOutOfStock
              ? "Productos agotados (sin existencias)"
              : "Productos con stock crítico o agotado",
            summary:
              rows.length === 0
                ? "No hay productos activos por debajo del umbral crítico."
                : `Se encontraron ${rows.length}${rows.length === 25 ? "+" : ""} productos activos con stock <= ${threshold} unidades.`,
            kpis: [
              {
                label: "Agotados (0 unid.)",
                value: String(outCount),
                tone: outCount > 0 ? "destructive" : "success",
              },
              {
                label: "Stock bajo (1-5 unid.)",
                value: String(lowCount),
                tone: lowCount > 0 ? "warning" : "neutral",
              },
            ],
            items: topItems,
            deepLink: canNavigateInventoryPage
              ? {
                  label: "Ver inventario crítico",
                  href: activeIntent.onlyOutOfStock
                    ? "/inventory?statuses=out_of_stock"
                    : "/inventory?statuses=low_stock,out_of_stock",
                }
              : { label: "Ver catálogo", href: "/catalog" },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "overdue_receivables":
        case "pending_receivables": {
          const onlyOverdue = activeIntent.intent === "overdue_receivables";
          const now = new Date();
          const minAmt = activeIntent.minAmountUsd ?? 0;
          const foldedArCust = activeIntent.searchTerm
            ? foldSearchText(activeIntent.searchTerm)
            : null;
          const escapedArCust = foldedArCust
            ? `%${escapeLikeSql(foldedArCust)}%`
            : null;
          const compactArCode = foldedArCust
            ? escapeLikeSql(foldedArCust.replace(/[^a-z0-9]/g, ""))
            : "";

          const arRows = await tx
            .select({
              id: AccountReceivable.id,
              balance: AccountReceivable.balance,
              dueDate: AccountReceivable.dueDate,
              status: AccountReceivable.status,
              customerName: Customer.name,
              customerRif: Customer.identification,
            })
            .from(AccountReceivable)
            .innerJoin(
              Customer,
              and(
                eq(AccountReceivable.customerId, Customer.id),
                eq(Customer.workspaceId, workspaceId),
              ),
            )
            .where(
              and(
                eq(AccountReceivable.workspaceId, workspaceId),
                inArray(AccountReceivable.status, [...OPEN_AR_STATUSES]),
                gt(AccountReceivable.balance, minAmt > 0 ? minAmt : 0),
                onlyOverdue ? lte(AccountReceivable.dueDate, now) : undefined,
                escapedArCust
                  ? or(
                      sql`translate(lower(${Customer.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedArCust}`,
                      compactArCode.length >= 3
                        ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactArCode}%`}`
                        : undefined,
                    )
                  : undefined,
              ),
            )
            .orderBy(desc(AccountReceivable.balance))
            .limit(30);

          const totalUsd = addMoney(...arRows.map((r) => Number(r.balance)));
          const items: QuickQueryResultRow[] = arRows.slice(0, 5).map((r) => {
            const isLate = r.dueDate.getTime() < now.getTime();
            return {
              id: r.id,
              title: r.customerName,
              subtitle: `${r.customerRif ?? "Sin RIF"} · Vence ${r.dueDate.toISOString().slice(0, 10)}`,
              badgeText: formatUsd(Number(r.balance)),
              badgeTone: isLate ? "destructive" : "warning",
              href: `/accounts-receivable/${r.id}`,
            };
          });

          return {
            query: input.q,
            intent: activeIntent.intent,
            source,
            headline: onlyOverdue
              ? "Cuentas por cobrar vencidas"
              : "Cuentas por cobrar abiertas",
            summary:
              arRows.length === 0
                ? onlyOverdue
                  ? "No hay cuentas vencidas con los criterios indicados."
                  : "No hay cuentas por cobrar pendientes."
                : `${arRows.length}${arRows.length === 30 ? "+" : ""} cuentas suman ${formatUsd(totalUsd)} pendientes.`,
            kpis: [
              {
                label: onlyOverdue ? "Monto vencido" : "Saldo abierto",
                value: formatUsd(totalUsd),
                tone:
                  totalUsd > 0
                    ? onlyOverdue
                      ? "destructive"
                      : "warning"
                    : "success",
              },
              {
                label: "Cuentas",
                value: `${arRows.length}${arRows.length === 30 ? "+" : ""}`,
                tone: "neutral",
              },
            ],
            items,
            deepLink: {
              label: onlyOverdue
                ? "Abrir CxC vencidas"
                : "Abrir Cuentas por Cobrar",
              href: onlyOverdue
                ? "/accounts-receivable?status=overdue"
                : "/accounts-receivable?status=open",
            },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "pending_orders":
        case "unpaid_orders": {
          const isUnpaidMode = activeIntent.intent === "unpaid_orders";
          const sinceDate = buildWindowStartDate(activeIntent.timeWindow);
          const minAmt = activeIntent.minAmountUsd ?? 0;
          const foldedOrdCust = activeIntent.searchTerm
            ? foldSearchText(activeIntent.searchTerm)
            : null;
          const escapedOrdCust = foldedOrdCust
            ? `%${escapeLikeSql(foldedOrdCust)}%`
            : null;

          const targetStatuses =
            activeIntent.orderSubfilter === "dispatch"
              ? (["confirmed", "prepared"] as const)
              : activeIntent.orderSubfilter === "approval"
                ? (["pending", "pending_confirmation"] as const)
                : ([
                    "pending",
                    "pending_confirmation",
                    "confirmed",
                    "prepared",
                  ] as const);

          const orderRows = await tx
            .select({
              id: SalesOrder.id,
              orderNumber: SalesOrder.orderNumber,
              status: SalesOrder.status,
              channel: SalesOrder.channel,
              total: SalesOrder.total,
              totalPaid: SalesOrder.totalPaid,
              createdAt: SalesOrder.createdAt,
              customerName: Customer.name,
            })
            .from(SalesOrder)
            .leftJoin(
              Customer,
              and(
                eq(SalesOrder.customerId, Customer.id),
                eq(Customer.workspaceId, workspaceId),
              ),
            )
            .where(
              and(
                eq(SalesOrder.workspaceId, workspaceId),
                vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
                activeIntent.channel
                  ? eq(SalesOrder.channel, activeIntent.channel)
                  : undefined,
                sinceDate ? gt(SalesOrder.createdAt, sinceDate) : undefined,
                escapedOrdCust
                  ? sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedOrdCust}`
                  : undefined,
                isUnpaidMode
                  ? sql`${SalesOrder.status} NOT IN ('cancelled', 'returned') AND (${SalesOrder.total} - COALESCE(${SalesOrder.totalPaid}, 0)) > ${Math.max(0.005, minAmt)}`
                  : inArray(SalesOrder.status, [...targetStatuses]),
              ),
            )
            .orderBy(desc(SalesOrder.createdAt))
            .limit(25);

          const sumAmount = isUnpaidMode
            ? addMoney(
                ...orderRows.map((r) =>
                  subtractMoney(Number(r.total), Number(r.totalPaid ?? 0)),
                ),
              )
            : addMoney(...orderRows.map((r) => Number(r.total)));

          const CHANNEL_LABEL: Record<string, string> = {
            store: "Tienda",
            mercadolibre: "MercadoLibre",
            vendors: "Vendedores",
            whatsapp: "WhatsApp",
            instagram: "Instagram",
          };

          const items: QuickQueryResultRow[] = orderRows
            .slice(0, 5)
            .map((r) => {
              const unpaid = subtractMoney(
                Number(r.total),
                Number(r.totalPaid ?? 0),
              );
              const chanLabel = CHANNEL_LABEL[r.channel] ?? r.channel;
              return {
                id: r.id,
                title: `Orden ${r.orderNumber}`,
                subtitle: `${r.customerName ?? "Consumidor"} · ${chanLabel}`,
                badgeText: isUnpaidMode
                  ? `Resta ${formatUsd(unpaid)}`
                  : formatUsd(Number(r.total)),
                badgeTone: isUnpaidMode ? "warning" : "info",
                href: `/orders/${r.id}`,
              };
            });

          return {
            query: input.q,
            intent: activeIntent.intent,
            source,
            headline: isUnpaidMode
              ? "Pedidos con saldo pendiente de pago"
              : "Pedidos operativos pendientes",
            summary:
              orderRows.length === 0
                ? "No se encontraron pedidos pendientes con esos filtros."
                : `${orderRows.length}${orderRows.length === 25 ? "+" : ""} pedidos suman ${formatUsd(sumAmount)}.`,
            kpis: [
              {
                label: isUnpaidMode ? "Saldo por cobrar" : "Total pedidos",
                value: formatUsd(sumAmount),
                tone: orderRows.length > 0 ? "warning" : "success",
              },
              {
                label: "Cantidad",
                value: `${orderRows.length}${orderRows.length === 25 ? "+" : ""}`,
                tone: "neutral",
              },
            ],
            items,
            deepLink: {
              label: "Abrir listado de pedidos",
              href: isUnpaidMode
                ? "/orders"
                : `/orders?statuses=${targetStatuses.join(",")}`,
            },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "open_quotes": {
          const now = new Date();
          const sinceDate = buildWindowStartDate(activeIntent.timeWindow);
          const foldedQtCust = activeIntent.searchTerm
            ? foldSearchText(activeIntent.searchTerm)
            : null;
          const escapedQtCust = foldedQtCust
            ? `%${escapeLikeSql(foldedQtCust)}%`
            : null;
          const escapedQtDoc = activeIntent.documentNumber
            ? `%${escapeLikeSql(foldSearchText(activeIntent.documentNumber))}%`
            : null;

          const quoteRows = await tx
            .select({
              id: Quote.id,
              quoteNumber: Quote.quoteNumber,
              status: Quote.status,
              total: Quote.total,
              validUntil: Quote.validUntil,
              customerName: Customer.name,
            })
            .from(Quote)
            .leftJoin(
              Customer,
              and(
                eq(Quote.customerId, Customer.id),
                eq(Customer.workspaceId, workspaceId),
              ),
            )
            .where(
              and(
                eq(Quote.workspaceId, workspaceId),
                vendorId ? eq(Quote.createdBy, vendorId) : undefined,
                sinceDate ? gt(Quote.createdAt, sinceDate) : undefined,
                escapedQtDoc
                  ? sql`lower(${Quote.quoteNumber}) LIKE ${escapedQtDoc}`
                  : undefined,
                escapedQtCust
                  ? sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedQtCust}`
                  : undefined,
                inArray(Quote.status, ["draft", "sent"]),
                sql`(${Quote.validUntil} IS NULL OR ${Quote.validUntil} >= ${now})`,
              ),
            )
            .orderBy(desc(Quote.createdAt))
            .limit(25);

          const totalQuoted = addMoney(
            ...quoteRows.map((r) => Number(r.total)),
          );

          return {
            query: input.q,
            intent: "open_quotes",
            source,
            headline: "Cotizaciones vigentes abiertas",
            summary:
              quoteRows.length === 0
                ? "No hay cotizaciones vigentes pendientes de conversión."
                : `${quoteRows.length}${quoteRows.length === 25 ? "+" : ""} cotizaciones activas por ${formatUsd(totalQuoted)}.`,
            kpis: [
              {
                label: "Total cotizado",
                value: formatUsd(totalQuoted),
                tone: "info",
              },
              {
                label: "Vigentes",
                value: `${quoteRows.length}${quoteRows.length === 25 ? "+" : ""}`,
                tone: "neutral",
              },
            ],
            items: quoteRows.slice(0, 5).map((r) => ({
              id: r.id,
              title: `Cotización ${r.quoteNumber}`,
              subtitle: `${r.customerName ?? "Sin cliente"} · ${r.status === "sent" ? "Enviada" : "Borrador"}`,
              badgeText: formatUsd(Number(r.total)),
              badgeTone: "info",
              href: `/quotes/${r.id}`,
            })),
            deepLink: { label: "Abrir cotizaciones", href: "/quotes" },
            latencyMs: Date.now() - startedAt,
          };
        }

        case "containers_status": {
          // NOTE: Never select `Container.costFob` or `ContainerItem.unitCost` here
          const foldedTerm = activeIntent.searchTerm
            ? foldSearchText(activeIntent.searchTerm)
            : null;

          if (foldedTerm) {
            const escapedContPattern = `%${escapeLikeSql(foldedTerm)}%`;
            const itemRows = await tx
              .select({
                itemId: ContainerItem.id,
                containerId: Container.id,
                containerNumber: Container.containerNumber,
                containerStatus: Container.status,
                quantityExpected: ContainerItem.quantityExpected,
                translatedName: ContainerItem.translatedName,
                originalName: ContainerItem.originalName,
                skuHint: ContainerItem.skuHint,
              })
              .from(ContainerItem)
              .innerJoin(
                Container,
                and(
                  eq(ContainerItem.containerId, Container.id),
                  eq(Container.workspaceId, workspaceId),
                ),
              )
              .where(
                and(
                  eq(ContainerItem.workspaceId, workspaceId),
                  sql`(
                  translate(lower(COALESCE(${ContainerItem.translatedName}, '')), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedContPattern}
                  OR translate(lower(COALESCE(${ContainerItem.originalName}, '')), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${escapedContPattern}
                  OR lower(COALESCE(${ContainerItem.skuHint}, '')) LIKE ${escapedContPattern}
                )`,
                ),
              )
              .orderBy(desc(Container.createdAt))
              .limit(15);

            const CONTAINER_STATUS_ES: Record<string, string> = {
              created: "Creado",
              in_transit: "En tránsito",
              received: "Recibido",
              closed: "Cerrado",
            };

            return {
              query: input.q,
              intent: "containers_status",
              source,
              headline: `Búsqueda en contenedores: "${activeIntent.searchTerm}"`,
              summary:
                itemRows.length === 0
                  ? `No se encontraron líneas con "${activeIntent.searchTerm}" en packing lists registrados.`
                  : `Se encontraron ${itemRows.length} líneas de embarque asociadas.`,
              kpis: [
                {
                  label: "Coincidencias",
                  value: String(itemRows.length),
                  tone: itemRows.length > 0 ? "info" : "neutral",
                },
              ],
              items: itemRows.slice(0, 5).map((r) => ({
                id: r.itemId,
                title: `${r.containerNumber} · ${r.translatedName ?? r.originalName ?? "Ítem"}`,
                subtitle: `Estado: ${CONTAINER_STATUS_ES[r.containerStatus] ?? r.containerStatus}${r.skuHint ? ` · SKU ${r.skuHint}` : ""}`,
                badgeText: `${r.quantityExpected} unid.`,
                badgeTone:
                  r.containerStatus === "in_transit" ? "info" : "neutral",
                href: `/containers/${r.containerId}`,
              })),
              deepLink: { label: "Abrir contenedores", href: "/containers" },
              latencyMs: Date.now() - startedAt,
            };
          }

          const containers = await tx
            .select({
              id: Container.id,
              containerNumber: Container.containerNumber,
              status: Container.status,
              arrivalDate: Container.arrivalDate,
              packingListItemCount: Container.packingListItemCount,
            })
            .from(Container)
            .where(
              and(
                eq(Container.workspaceId, workspaceId),
                inArray(Container.status, ["in_transit", "created"]),
              ),
            )
            .orderBy(desc(Container.createdAt))
            .limit(20);

          const inTransitCount = containers.filter(
            (c) => c.status === "in_transit",
          ).length;

          return {
            query: input.q,
            intent: "containers_status",
            source,
            headline: "Contenedores activos y en tránsito",
            summary:
              containers.length === 0
                ? "No hay contenedores en tránsito o en preparación actualmente."
                : `${inTransitCount} contenedores en tránsito y ${containers.length - inTransitCount} en preparación.`,
            kpis: [
              {
                label: "En tránsito",
                value: String(inTransitCount),
                tone: inTransitCount > 0 ? "info" : "neutral",
              },
              {
                label: "En preparación",
                value: String(containers.length - inTransitCount),
                tone: "neutral",
              },
            ],
            items: containers.slice(0, 5).map((c) => ({
              id: c.id,
              title: c.containerNumber,
              subtitle: c.arrivalDate
                ? `ETA ${c.arrivalDate.toISOString().slice(0, 10)} · ${c.packingListItemCount} ítems`
                : `${c.packingListItemCount} ítems registrados`,
              badgeText: c.status === "in_transit" ? "En tránsito" : "Creado",
              badgeTone: c.status === "in_transit" ? "info" : "neutral",
              href: `/containers/${c.id}`,
            })),
            deepLink: { label: "Abrir contenedores", href: "/containers" },
            latencyMs: Date.now() - startedAt,
          };
        }
      }
    },
  );

  return {
    ...rawRes,
    resolvedIntentObject: activeIntent,
    guardrailBlocked,
  };
}

// ──────────────────────────────────────────────
// Multi-Turn Conversational Copilot Orchestrator (`search.copilotChat`)
// ──────────────────────────────────────────────

interface CopilotModuleCapabilities {
  canAr: boolean;
  canPay: boolean;
  canInv: boolean;
  canOrd: boolean;
  canCont: boolean;
}

function buildContextualFollowUps(
  intent: QuickQueryIntent["intent"],
  caps: CopilotModuleCapabilities,
  resolved: QuickQueryIntent,
): string[] {
  const { canAr, canPay, canInv, canOrd, canCont } = caps;
  const hasCustomerContext = Boolean(resolved.searchTerm?.trim());

  switch (intent) {
    case "invoice_lookup":
    case "order_detail_lookup":
    case "delivery_note_lookup":
    case "credit_note_lookup":
    case "customer_lookup": {
      const next: string[] = [];
      if (hasCustomerContext) {
        if (canAr) next.push("¿Y tiene cuentas por cobrar vencidas?");
        if (canPay && intent !== "invoice_lookup") {
          next.push("¿Y cómo nos pagó?");
        }
        if (canOrd && intent !== "order_detail_lookup") {
          next.push("¿Qué otros pedidos nos ha hecho?");
        }
        if (canOrd && intent !== "delivery_note_lookup") {
          next.push("¿Y su última nota de entrega?");
        }
      } else {
        if (canOrd) next.push("¿Cuánto hemos vendido hoy?");
        if (canPay) next.push("¿Qué pagos entraron hoy?");
      }
      next.push("¿A cómo está el dólar BCV hoy?");
      return next.slice(0, 3);
    }
    case "payment_lookup": {
      if (!canPay) {
        return ["¿Cómo vamos hoy?", "¿A cómo está la tasa BCV hoy?"];
      }
      const next: string[] = [];
      if (resolved.paymentMethod !== "zelle") {
        next.push("¿Y solo los pagos por Zelle?");
      }
      if (resolved.timeWindow !== "today") {
        next.push("¿Y los pagos de hoy?");
      }
      if (canAr) next.push("¿Cuáles cuentas por cobrar están vencidas?");
      else next.push("¿A cómo está la tasa BCV hoy?");
      return next.slice(0, 3);
    }
    case "daily_pulse": {
      const next: string[] = [];
      if (canOrd) next.push("¿Cuál fue la última factura emitida?");
      if (canInv) next.push("¿Qué productos están por agotarse?");
      if (canAr) next.push("¿Cuáles cuentas por cobrar están vencidas?");
      else next.push("¿A cómo está la tasa BCV hoy?");
      return next.slice(0, 3);
    }
    case "pending_orders":
    case "unpaid_orders": {
      if (!canOrd) {
        return ["¿Cómo vamos hoy?", "¿A cómo está la tasa BCV hoy?"];
      }
      const next: string[] = [];
      if (resolved.channel !== "whatsapp") {
        next.push("¿Y solo los de WhatsApp?");
      }
      if (intent !== "unpaid_orders") {
        next.push("¿Cuáles pedidos tienen saldo sin pagar?");
      } else {
        next.push("¿Cuánto hemos vendido hoy?");
      }
      next.push("¿A cómo está el dólar BCV?");
      return next.slice(0, 3);
    }
    case "sales_summary":
    case "top_products": {
      if (!canOrd) {
        return ["¿Cómo vamos hoy?", "¿A cómo está la tasa BCV hoy?"];
      }
      const next: string[] = [];
      if (intent !== "top_products") {
        next.push("¿Cuáles son los productos más vendidos?");
      }
      if (resolved.timeWindow !== "7d") {
        next.push("¿Y las ventas de esta semana?");
      }
      if (resolved.channel !== "store") {
        next.push("¿Y solo las ventas de tienda?");
      }
      return next.slice(0, 3);
    }
    case "low_stock":
    case "warehouse_stock_lookup": {
      if (!canInv) {
        return ["¿Cómo vamos hoy?", "¿A cómo está la tasa BCV hoy?"];
      }
      const next: string[] = [];
      if (intent === "low_stock" && !resolved.onlyOutOfStock) {
        next.push("¿Cuáles están totalmente agotados en cero?");
      }
      if (intent !== "warehouse_stock_lookup") {
        next.push("¿Cómo está el stock por almacén?");
      }
      if (canCont) next.push("¿Qué contenedores vienen en tránsito?");
      return next.slice(0, 3);
    }
    case "overdue_receivables":
    case "pending_receivables": {
      if (!canAr) {
        return ["¿Cómo vamos hoy?", "¿A cómo está la tasa BCV hoy?"];
      }
      const next: string[] = [
        "¿Y las cuentas mayores a $500?",
        "¿Cómo vamos hoy en general?",
      ];
      if (canOrd) next.push("¿Cuáles pedidos siguen sin pagar?");
      return next.slice(0, 3);
    }
    case "exchange_rate": {
      const next: string[] = ["Convierte 250 dólares a bolívares"];
      if (canOrd) next.push("¿Cuánto hemos vendido hoy?");
      if (canInv) next.push("¿Qué productos están con stock bajo?");
      return next.slice(0, 3);
    }
    default: {
      const next: string[] = ["¿Cómo vamos hoy?"];
      if (canOrd) next.push("¿Cuál fue la última factura emitida?");
      if (canInv) next.push("¿Qué productos tienen stock crítico?");
      else next.push("¿A cómo está la tasa BCV hoy?");
      return next.slice(0, 3);
    }
  }
}

export async function executeCopilotChat(
  ctx: HybridSearchExecutionContext,
  input: CopilotChatInput,
): Promise<CopilotChatResponse> {
  const startedAt = Date.now();
  const { role } = ctx.workspace;
  const res = await executeQuickAiQuery(
    ctx,
    { q: input.message },
    input.history,
  );
  const resolved = res.resolvedIntentObject ?? { intent: res.intent };

  const caps: CopilotModuleCapabilities = {
    canAr:
      can(role, "receivables", "read") &&
      (await isModuleEnabled(ctx, "receivables")),
    canPay:
      can(role, "payments", "read") && (await isModuleEnabled(ctx, "payments")),
    canInv:
      can(role, "inventory", "read") &&
      (await isModuleEnabled(ctx, "inventory")),
    canOrd:
      can(role, "orders", "read") && (await isModuleEnabled(ctx, "orders")),
    canCont:
      can(role, "containers", "read") &&
      (await isModuleEnabled(ctx, "containers")),
  };

  let finalReply = res.summary;
  let finalItems = res.items;
  let finalKpis = res.kpis;
  const finalSource = res.source;

  // Automatic semantic fallback when a natural product inquiry had 0 literal SQL hits
  if (
    res.intent === "catalog_lookup" &&
    !res.accessDenied &&
    !res.guardrailBlocked &&
    res.items.length === 0 &&
    (resolved.searchTerm ?? input.message).trim().length >= 3
  ) {
    const term = (resolved.searchTerm ?? input.message).trim();
    const sem = await executeSemanticHybridSearch(ctx, { q: term, limit: 5 });
    if (sem.products.length > 0) {
      finalItems = sem.products.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: [`SKU ${p.sku}`, p.brandName, p.categoryName]
          .filter(Boolean)
          .join(" · "),
        badgeText: "Coincidencia semántica",
        badgeTone: "info",
        href: p.href,
      }));
      finalKpis = [
        {
          label: "Relacionados",
          value: String(sem.products.length),
          tone: "info",
        },
      ];
      finalReply = `No encontré el nombre exacto "${term}", pero por significado hallé ${sem.products.length} producto${sem.products.length === 1 ? "" : "s"} relacionado${sem.products.length === 1 ? "" : "s"} (como ${sem.products[0]?.name}):`;
    } else if (sem.documents.length > 0) {
      finalItems = sem.documents.map((d) => ({
        id: d.chunkId,
        title: d.documentNumber ? `${d.title} (${d.documentNumber})` : d.title,
        subtitle: d.snippet,
        badgeText: "Documento",
        badgeTone: "neutral",
        href: d.href,
      }));
      finalReply = `No encontré un producto exacto en catálogo para "${term}", pero aparece mencionado en ${sem.documents.length} documento${sem.documents.length === 1 ? "" : "s"} comercial${sem.documents.length === 1 ? "" : "es"}:`;
    }
  }

  if (res.accessDenied) {
    finalReply = `${res.summary} Si deseas, puedo ayudarte con consultas de catálogo, precios en USD/Bs, tasa BCV o las operaciones habilitadas para tu rol.`;
  }

  return {
    reply: finalReply,
    headline: res.headline,
    intent: res.intent,
    resolvedFilters: {
      searchTerm: resolved.searchTerm ?? null,
      documentNumber: resolved.documentNumber ?? null,
      orderSubfilter: resolved.orderSubfilter ?? null,
      channel: resolved.channel ?? null,
      paymentMethod: resolved.paymentMethod ?? null,
      timeWindow: resolved.timeWindow ?? null,
      minAmountUsd: resolved.minAmountUsd ?? null,
      onlyOutOfStock: resolved.onlyOutOfStock ?? null,
    },
    source: finalSource,
    accessDenied: res.accessDenied,
    details: res.details ?? [],
    quickActions: res.quickActions ?? [],
    kpis: finalKpis,
    items: finalItems,
    deepLink: res.deepLink,
    followUps: buildContextualFollowUps(
      res.accessDenied ? "erp_help" : res.intent,
      caps,
      resolved,
    ),
    latencyMs: Date.now() - startedAt,
  };
}
