/**
 * Cendaro — Global Search Router (PLAN-2026-09-MIDDAY-REDESIGN §T2.11)
 *
 * One `⌘K` query fans out to 6 result types in parallel: products,
 * customers, orders (incl. invoices/delivery-notes, which are just orders
 * with a different document), quotes, containers, suppliers. `workspace_id`
 * is filtered explicitly on every sub-query — this route uses
 * `workspaceReadProcedure`, which skips RLS/SET LOCAL for read performance
 * (see `../trpc`), so there is no database-level backstop here.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";

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
import { NAV_ROLE_RULES } from "@cendaro/validators";

import type { createTRPCContext } from "../trpc";
import { createTRPCRouter, workspaceReadProcedure } from "../trpc";

const RESULTS_PER_TYPE = 5;

export type SearchItemType =
  "product" | "customer" | "order" | "quote" | "container" | "supplier";

export interface SearchItem {
  type: SearchItemType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
}

type Context = Awaited<ReturnType<typeof createTRPCContext>> & {
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
// Rate limit — 20 req / 10s per user, in-memory token bucket
// (same pattern as `permissionCache` in `../trpc`: process-local, no Redis)
// ──────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_MAX_BUCKETS = 1000;

interface RateBucket {
  count: number;
  windowStart: number;
}

const rateLimitBuckets = new Map<string, RateBucket>();

/** Throws TOO_MANY_REQUESTS if `userId` exceeds the search rate limit. */
export function checkSearchRateLimit(userId: string): void {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(userId);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    if (rateLimitBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
      const oldest = rateLimitBuckets.keys().next().value;
      if (oldest) rateLimitBuckets.delete(oldest);
    }
    rateLimitBuckets.set(userId, { count: 1, windowStart: now });
    return;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Demasiadas búsquedas — espera unos segundos e intenta de nuevo",
    });
  }

  bucket.count += 1;
}

// ──────────────────────────────────────────────
// Per-type queries
// ──────────────────────────────────────────────

async function searchProducts(
  ctx: Context,
  pattern: string,
): Promise<SearchItem[]> {
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
        or(ilike(Product.name, pattern), ilike(Product.sku, pattern)),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "product",
    id: r.id,
    title: r.name,
    subtitle: r.sku,
    href: `/catalog/${r.id}`,
    status: r.status,
  }));
}

async function searchCustomers(
  ctx: Context,
  pattern: string,
): Promise<SearchItem[]> {
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
        or(
          ilike(Customer.name, pattern),
          ilike(Customer.identification, pattern),
          ilike(Customer.phone, pattern),
        ),
      ),
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
  ctx: Context,
  pattern: string,
  role: UserRole | null | undefined,
): Promise<SearchItem[]> {
  const sources: Promise<SearchItem[]>[] = [
    ctx.db
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
          ilike(SalesOrder.orderNumber, pattern),
        ),
      )
      .orderBy(desc(SalesOrder.createdAt))
      .limit(RESULTS_PER_TYPE)
      .then((rows) =>
        rows.map((r) => ({
          type: "order" as const,
          id: r.id,
          title: `Orden ${r.orderNumber}`,
          subtitle: r.status,
          href: `/orders/${r.id}`,
          status: r.status,
        })),
      ),
  ];

  if (canSearchDeliveryNotes(role)) {
    sources.push(
      ctx.db
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
            ilike(DeliveryNote.noteNumber, pattern),
          ),
        )
        .orderBy(desc(DeliveryNote.createdAt))
        .limit(RESULTS_PER_TYPE)
        .then((rows) =>
          rows.map((r) => ({
            type: "order" as const,
            id: r.id,
            title: `Nota de Entrega ${r.noteNumber}`,
            subtitle: r.status,
            // No dedicated detail route — the source order's view is the
            // correct place to see a delivery note in context.
            href: `/orders/${r.orderId}`,
            status: r.status,
          })),
        ),
    );
  }

  if (canSearchInvoices(role)) {
    sources.push(
      ctx.db
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
            ilike(InternalInvoice.invoiceNumber, pattern),
          ),
        )
        .orderBy(desc(InternalInvoice.createdAt))
        .limit(RESULTS_PER_TYPE)
        .then((rows) =>
          rows.map((r) => ({
            type: "order" as const,
            id: r.id,
            title: `Factura ${r.invoiceNumber}`,
            subtitle: r.status,
            href: `/orders/${r.orderId}`,
            status: r.status,
          })),
        ),
    );
  }

  const results = await Promise.all(sources);
  return results.flat().slice(0, RESULTS_PER_TYPE);
}

async function searchQuotes(
  ctx: Context,
  pattern: string,
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
        ilike(Quote.quoteNumber, pattern),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "quote",
    id: r.id,
    title: `Cotización ${r.quoteNumber}`,
    subtitle: r.status,
    href: `/quotes/${r.id}`,
    status: r.status,
  }));
}

async function searchContainers(
  ctx: Context,
  pattern: string,
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
        ilike(Container.containerNumber, pattern),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "container",
    id: r.id,
    title: r.containerNumber,
    subtitle: r.status,
    href: `/containers/${r.id}`,
    status: r.status,
  }));
}

async function searchSuppliers(
  ctx: Context,
  pattern: string,
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
        or(ilike(Supplier.name, pattern), ilike(Supplier.rif, pattern)),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((r) => ({
    type: "supplier",
    id: r.id,
    // No dedicated /catalog/suppliers/[id] route exists yet — the list
    // page is the correct destination until one is built.
    title: r.name,
    subtitle: r.rif ?? "",
    href: `/catalog/suppliers`,
  }));
}

export const searchRouter = createTRPCRouter({
  global: workspaceReadProcedure
    .input(z.object({ q: z.string().trim().min(2).max(64) }))
    .query(async ({ ctx, input }): Promise<SearchItem[]> => {
      checkSearchRateLimit(ctx.user.id);

      const start = performance.now();
      const role = ctx.user.user_metadata?.role;
      const pattern = `%${escapeLike(input.q)}%`;

      const groups: Promise<SearchItem[]>[] = [
        searchProducts(ctx, pattern),
        searchCustomers(ctx, pattern),
        searchOrders(ctx, pattern, role),
        searchQuotes(ctx, pattern),
        searchSuppliers(ctx, pattern),
      ];

      if (canSearchContainers(role)) {
        groups.push(searchContainers(ctx, pattern));
      }

      const results = await Promise.all(groups);
      const durationMs = Math.round(performance.now() - start);
      if (durationMs > 150) {
        ctx.log.warn(`⚠ SLOW search.global`, { durationMs, q: input.q });
      }

      return results.flat();
    }),
});
