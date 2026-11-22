/**
 * Cendaro — 3-Tier Hybrid Global Search Router (PLAN-2026-09-DESIGN-SYSTEM §T2.11 + Hybrid AI)
 *
 * Exposes three progressive tiers for the `⌘K` Command Palette:
 *   • `search.global` (Tier 0, <25ms, 0 Gemini calls): accent-insensitive (`translate`) +
 *     typo-tolerant (`extensions.word_similarity` / `pg_trgm`) entity lookup across Products,
 *     Customers, Orders/Invoices/DeliveryNotes, Quotes, Containers, and Suppliers.
 *   • `search.semantic` (Tier 1): `gemini-embedding-001` (1,536-dim) + pgvector HNSW RRF
 *     across `product_embedding` and `rag_document_chunks`, protected by L1 tenant LRU cache
 *     and 4-rule `rate_limit_bucket` quota reservation.
 *   • `search.askAi` (Tier 2): Zero-PII Quick Operational Query Engine (<1ms deterministic
 *     grammar + `gemini-3.5-flash-lite` structured JSON fallback -> local Drizzle under RLS).
 *
 * Every procedure uses `wsReadPermissionProcedure("dashboard", "read", { deferRlsTransaction: true })`
 * so rate-limiting, module-plan checks, and external Gemini HTTP calls finish with 0 held
 * Supavisor (:6543) pool connections before opening a short `runInWorkspaceRlsReadonly` tx.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import type { UserRole } from "@cendaro/validators";
import {
  Container,
  Customer,
  DeliveryNote,
  InternalInvoice,
  Product,
  Quote,
  SalesOrder,
  Supplier,
} from "@cendaro/db/schema";
import {
  can,
  copilotChatInputSchema,
  globalSearchInputSchema,
  NAV_ROLE_RULES,
  quickAiQueryInputSchema,
  semanticSearchInputSchema,
} from "@cendaro/validators";

import type { createTRPCContext } from "../trpc";
import { getRateLimitStore } from "../services/rate-limit";
import {
  executeCopilotChat,
  executeQuickAiQuery,
  executeSemanticHybridSearch,
  foldSearchText,
  SQL_ACCENT_FROM,
  SQL_ACCENT_TO,
} from "../services/search/hybrid-search-engine";
import {
  createTRPCRouter,
  isModuleEnabled,
  runInWorkspaceRlsReadonly,
  wsReadPermissionProcedure,
} from "../trpc";
import { vendorScopeId } from "./vendor-scope";

const RESULTS_PER_TYPE = 5;

export type SearchItemType =
  "product" | "customer" | "order" | "quote" | "container" | "supplier";

export type SearchStatusDomain =
  "product" | "order" | "deliveryNote" | "quote" | "container";

export interface SearchItem {
  type: SearchItemType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
  statusDomain?: SearchStatusDomain;
}

type Db = ReturnType<typeof getDb>;

type QueryContext = Awaited<ReturnType<typeof createTRPCContext>> & {
  db: Db;
  workspace: { workspaceId: string };
};

// ──────────────────────────────────────────────
// LIKE-pattern escaping — user input never reaches ILIKE unescaped
// ──────────────────────────────────────────────

/**
 * Escapes `%`, `_` and `\` so a search term can't widen its own ILIKE
 * pattern (e.g. searching "50%" shouldn't match everything).
 */
export function escapeLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ──────────────────────────────────────────────
// Role redaction — mirrors NAV_ROLE_RULES, decided server-side
// ──────────────────────────────────────────────

function roleAllows(
  role: UserRole | null | undefined,
  rule: readonly UserRole[],
): boolean {
  return !!role && rule.includes(role);
}

/** Containers are gated exactly like the "Contenedores" nav entry. */
export function canSearchContainers(
  role: UserRole | null | undefined,
): boolean {
  return roleAllows(role, NAV_ROLE_RULES.containers);
}

/** Invoices are gated exactly like the "Facturas" nav entry. */
export function canSearchInvoices(role: UserRole | null | undefined): boolean {
  return roleAllows(role, NAV_ROLE_RULES.invoices);
}

/** Delivery notes are gated exactly like the "Notas de Entrega" nav entry. */
export function canSearchDeliveryNotes(
  role: UserRole | null | undefined,
): boolean {
  return roleAllows(role, NAV_ROLE_RULES.deliveryNotes);
}

// ──────────────────────────────────────────────
// Rate limit — 20 req / 10s per user, in the store shared by every instance
// ──────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

/**
 * Throws TOO_MANY_REQUESTS if `userId` exceeds the search rate limit.
 *
 * Runs on the pooled `postgres` connection BEFORE `runInWorkspaceRlsReadonly`
 * opens its `app_user` transaction (`deferRlsTransaction: true`), preventing
 * pool self-contention on Supavisor (:6543).
 */
export async function checkSearchRateLimit(userId: string): Promise<void> {
  const { success } = await getRateLimitStore().consume(
    [
      {
        key: `search:user:${userId}`,
        windowMs: RATE_LIMIT_WINDOW_MS,
        max: RATE_LIMIT_MAX_REQUESTS,
      },
    ],
    Date.now(),
  );

  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Demasiadas búsquedas — espera unos segundos e intenta de nuevo",
    });
  }
}

// ──────────────────────────────────────────────
// Per-type queries (accent-folded + pg_trgm word_similarity, deterministic ORDER BY)
// ──────────────────────────────────────────────

async function searchProducts(
  ctx: QueryContext,
  rawQuery: string,
  rawPattern: string,
  foldedPattern: string,
  foldedTerm: string,
): Promise<SearchItem[]> {
  const enableFuzzy = foldedTerm.length >= 3;
  const skuPrefixPattern = `${escapeLike(foldedTerm)}%`;
  const rows = await ctx.db
    .select({
      id: Product.id,
      name: Product.name,
      sku: Product.sku,
      status: Product.status,
    })
    .from(Product)
    .where(
      and(
        eq(Product.workspaceId, ctx.workspace.workspaceId),
        or(
          ilike(Product.name, rawPattern),
          ilike(Product.sku, rawPattern),
          ilike(Product.barcode, rawPattern),
          sql`translate(lower(${Product.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${foldedPattern}`,
          enableFuzzy
            ? sql`extensions.word_similarity(${foldedTerm}, translate(lower(${Product.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO})) >= 0.38`
            : undefined,
        ),
      ),
    )
    .orderBy(
      sql`CASE
        WHEN lower(${Product.sku}) = ${foldedTerm} OR ${Product.barcode} = ${rawQuery} THEN 0
        WHEN lower(${Product.sku}) LIKE ${skuPrefixPattern} THEN 1
        WHEN translate(lower(${Product.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${foldedPattern} THEN 2
        ELSE 3
      END`,
      asc(Product.name),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "product",
    id: r.id,
    title: r.name,
    subtitle: `SKU ${r.sku}`,
    href: `/catalog/${r.id}`,
    status: r.status,
    statusDomain: "product",
  }));
}

async function searchCustomers(
  ctx: QueryContext,
  rawPattern: string,
  foldedPattern: string,
  foldedTerm: string,
  compactCode: string,
  vendorId: string | null,
): Promise<SearchItem[]> {
  const enableFuzzy = foldedTerm.length >= 3;
  const rows = await ctx.db
    .select({
      id: Customer.id,
      name: Customer.name,
      identification: Customer.identification,
      phone: Customer.phone,
    })
    .from(Customer)
    .where(
      and(
        eq(Customer.workspaceId, ctx.workspace.workspaceId),
        vendorId ? eq(Customer.assignedVendorId, vendorId) : undefined,
        or(
          ilike(Customer.name, rawPattern),
          ilike(Customer.identification, rawPattern),
          ilike(Customer.phone, rawPattern),
          sql`translate(lower(${Customer.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${foldedPattern}`,
          compactCode.length >= 3
            ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactCode}%`}`
            : undefined,
          enableFuzzy
            ? sql`extensions.word_similarity(${foldedTerm}, translate(lower(${Customer.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO})) >= 0.4`
            : undefined,
        ),
      ),
    )
    .orderBy(
      sql`CASE
        WHEN translate(lower(${Customer.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${foldedPattern} THEN 0
        ELSE 1
      END`,
      asc(Customer.name),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "customer",
    id: r.id,
    title: r.name,
    subtitle: r.identification ?? r.phone ?? "",
    href: `/customers/${r.id}`,
  }));
}

async function searchOrders(
  ctx: QueryContext,
  rawPattern: string,
  role: UserRole | null | undefined,
  vendorId: string | null,
): Promise<SearchItem[]> {
  const collected: SearchItem[] = [];

  const orderRows = await ctx.db
    .select({
      id: SalesOrder.id,
      orderNumber: SalesOrder.orderNumber,
      status: SalesOrder.status,
      createdAt: SalesOrder.createdAt,
    })
    .from(SalesOrder)
    .where(
      and(
        eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
        vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
        ilike(SalesOrder.orderNumber, rawPattern),
      ),
    )
    .orderBy(desc(SalesOrder.createdAt))
    .limit(RESULTS_PER_TYPE);

  for (const r of orderRows) {
    collected.push({
      type: "order",
      id: r.id,
      title: `Orden ${r.orderNumber}`,
      subtitle: "Pedido de venta",
      href: `/orders/${r.id}`,
      status: r.status,
      statusDomain: "order",
    });
  }

  if (canSearchDeliveryNotes(role)) {
    const dnRows = await ctx.db
      .select({
        id: DeliveryNote.id,
        orderId: DeliveryNote.orderId,
        noteNumber: DeliveryNote.noteNumber,
        status: DeliveryNote.status,
        createdAt: DeliveryNote.createdAt,
      })
      .from(DeliveryNote)
      .where(
        and(
          eq(DeliveryNote.workspaceId, ctx.workspace.workspaceId),
          ilike(DeliveryNote.noteNumber, rawPattern),
        ),
      )
      .orderBy(desc(DeliveryNote.createdAt))
      .limit(RESULTS_PER_TYPE);

    for (const r of dnRows) {
      collected.push({
        type: "order",
        id: r.id,
        title: `Nota de Entrega ${r.noteNumber}`,
        subtitle: "Nota de entrega",
        href: `/orders/${r.orderId}`,
        status: r.status,
        statusDomain: "deliveryNote",
      });
    }
  }

  if (canSearchInvoices(role)) {
    const invRows = await ctx.db
      .select({
        id: InternalInvoice.id,
        orderId: InternalInvoice.orderId,
        invoiceNumber: InternalInvoice.invoiceNumber,
        status: InternalInvoice.status,
        createdAt: InternalInvoice.createdAt,
      })
      .from(InternalInvoice)
      .where(
        and(
          eq(InternalInvoice.workspaceId, ctx.workspace.workspaceId),
          ilike(InternalInvoice.invoiceNumber, rawPattern),
        ),
      )
      .orderBy(desc(InternalInvoice.createdAt))
      .limit(RESULTS_PER_TYPE);

    for (const r of invRows) {
      collected.push({
        type: "order",
        id: r.id,
        title: `Factura ${r.invoiceNumber}`,
        subtitle: "Factura interna",
        href: `/orders/${r.orderId}`,
        status: r.status,
        statusDomain: "order",
      });
    }
  }

  return collected.slice(0, RESULTS_PER_TYPE);
}

async function searchQuotes(
  ctx: QueryContext,
  rawPattern: string,
  vendorId: string | null,
): Promise<SearchItem[]> {
  const rows = await ctx.db
    .select({
      id: Quote.id,
      quoteNumber: Quote.quoteNumber,
      status: Quote.status,
    })
    .from(Quote)
    .where(
      and(
        eq(Quote.workspaceId, ctx.workspace.workspaceId),
        vendorId ? eq(Quote.createdBy, vendorId) : undefined,
        ilike(Quote.quoteNumber, rawPattern),
      ),
    )
    .orderBy(desc(Quote.createdAt))
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "quote",
    id: r.id,
    title: `Cotización ${r.quoteNumber}`,
    subtitle: "Cotización comercial",
    href: `/quotes/${r.id}`,
    status: r.status,
    statusDomain: "quote",
  }));
}

async function searchContainers(
  ctx: QueryContext,
  rawPattern: string,
): Promise<SearchItem[]> {
  const rows = await ctx.db
    .select({
      id: Container.id,
      containerNumber: Container.containerNumber,
      status: Container.status,
    })
    .from(Container)
    .where(
      and(
        eq(Container.workspaceId, ctx.workspace.workspaceId),
        ilike(Container.containerNumber, rawPattern),
      ),
    )
    .orderBy(desc(Container.createdAt))
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "container",
    id: r.id,
    title: r.containerNumber,
    subtitle: "Embarque marítimo",
    href: `/containers/${r.id}`,
    status: r.status,
    statusDomain: "container",
  }));
}

async function searchSuppliers(
  ctx: QueryContext,
  rawPattern: string,
  foldedPattern: string,
  showSupplierRif: boolean,
): Promise<SearchItem[]> {
  const rows = await ctx.db
    .select({
      id: Supplier.id,
      name: Supplier.name,
      rif: Supplier.rif,
    })
    .from(Supplier)
    .where(
      and(
        eq(Supplier.workspaceId, ctx.workspace.workspaceId),
        or(
          ilike(Supplier.name, rawPattern),
          showSupplierRif ? ilike(Supplier.rif, rawPattern) : undefined,
          sql`translate(lower(${Supplier.name}), ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}) LIKE ${foldedPattern}`,
        ),
      ),
    )
    .orderBy(asc(Supplier.name))
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "supplier",
    id: r.id,
    title: r.name,
    subtitle: showSupplierRif ? (r.rif ?? "Proveedor") : "Proveedor",
    href: `/catalog/suppliers`,
  }));
}

export const searchRouter = createTRPCRouter({
  global: wsReadPermissionProcedure("dashboard", "read", {
    deferRlsTransaction: true,
  })
    .input(globalSearchInputSchema)
    .query(async ({ ctx, input }): Promise<SearchItem[]> => {
      await checkSearchRateLimit(ctx.user.id);

      const start = performance.now();
      const role = ctx.workspace.role;
      const rawPattern = `%${escapeLike(input.q)}%`;
      const foldedTerm = foldSearchText(input.q);
      const foldedPattern = `%${escapeLike(foldedTerm)}%`;
      const compactCode = escapeLike(foldedTerm.replace(/[^a-z0-9]/g, ""));
      const vendorId = vendorScopeId(ctx);
      const showSupplierRif = can(role, "pricing", "read");

      // Resolve plan module gates outside `runInWorkspaceRlsReadonly` (cached in `moduleCache`)
      const catalogEnabled =
        can(role, "catalog", "read") && (await isModuleEnabled(ctx, "catalog"));
      const customersEnabled =
        can(role, "customers", "read") &&
        (await isModuleEnabled(ctx, "customers"));
      const ordersEnabled =
        can(role, "orders", "read") && (await isModuleEnabled(ctx, "orders"));
      const containersEnabled =
        canSearchContainers(role) && (await isModuleEnabled(ctx, "containers"));

      const executeOnDb = async (dbHandle: Db): Promise<SearchItem[]> => {
        const scopedCtx: QueryContext = { ...ctx, db: dbHandle };
        const items: SearchItem[] = [];

        if (catalogEnabled) {
          items.push(
            ...(await searchProducts(
              scopedCtx,
              input.q,
              rawPattern,
              foldedPattern,
              foldedTerm,
            )),
          );
          items.push(
            ...(await searchSuppliers(
              scopedCtx,
              rawPattern,
              foldedPattern,
              showSupplierRif,
            )),
          );
        }
        if (customersEnabled) {
          items.push(
            ...(await searchCustomers(
              scopedCtx,
              rawPattern,
              foldedPattern,
              foldedTerm,
              compactCode,
              vendorId,
            )),
          );
        }
        if (ordersEnabled) {
          items.push(
            ...(await searchOrders(scopedCtx, rawPattern, role, vendorId)),
          );
          items.push(...(await searchQuotes(scopedCtx, rawPattern, vendorId)));
        }
        if (containersEnabled) {
          items.push(...(await searchContainers(scopedCtx, rawPattern)));
        }

        return items;
      };

      const canOpenReadonlyTx =
        typeof (ctx.db as unknown as { transaction?: unknown }).transaction ===
        "function";

      const results = canOpenReadonlyTx
        ? await runInWorkspaceRlsReadonly(
            ctx.db,
            ctx.workspace.workspaceId,
            executeOnDb,
          )
        : await executeOnDb(ctx.db);

      const durationMs = Math.round(performance.now() - start);
      if (durationMs > 150) {
        ctx.log.warn(`⚠ SLOW search.global`, { durationMs, q: input.q });
      }

      return results;
    }),

  semantic: wsReadPermissionProcedure("dashboard", "read", {
    deferRlsTransaction: true,
  })
    .input(semanticSearchInputSchema)
    .query(async ({ ctx, input }) => {
      await checkSearchRateLimit(ctx.user.id);
      return executeSemanticHybridSearch(ctx, input);
    }),

  askAi: wsReadPermissionProcedure("dashboard", "read", {
    deferRlsTransaction: true,
  })
    .input(quickAiQueryInputSchema)
    .query(async ({ ctx, input }) => {
      await checkSearchRateLimit(ctx.user.id);
      return executeQuickAiQuery(ctx, input);
    }),

  copilotChat: wsReadPermissionProcedure("dashboard", "read")
    .input(copilotChatInputSchema)
    .mutation(async ({ ctx, input }) => {
      await checkSearchRateLimit(ctx.user.id);
      return executeCopilotChat(ctx, input);
    }),
});
