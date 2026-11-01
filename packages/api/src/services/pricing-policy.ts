/**
 * Cendaro — Selling price policy.
 *
 * Every line is checked against the catalog on the server, whatever the client
 * sends: a product without a price cannot be sold, staff may go at most
 * PRICING_POLICY.staffMaxDiscountRatio below catalog, and nobody goes below the
 * average cost without an approval. Callers decide what a line below its floor
 * means: the POS rejects the sale, an order waits for approval.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import type { salesChannelEnum } from "@cendaro/db/schema";
import { Product, ProductPrice } from "@cendaro/db/schema";
import { can, MONEY_EPSILON, PRICING_POLICY } from "@cendaro/validators";

import type { WorkspaceMembership } from "../trpc";

export interface PricedLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface PricingContext {
  db: ReturnType<typeof getDb>;
  workspace: WorkspaceMembership;
}

type SalesChannel = (typeof salesChannelEnum.enumValues)[number];
interface PriceRow {
  priceType: string;
  amountUsd: number;
}

const UNSELLABLE_STATUSES: readonly string[] = ["draft", "discontinued"];

/** Price types that may set the reference for a channel, besides `store`. */
function referencePrice(
  channel: SalesChannel,
  prices: readonly PriceRow[],
): number | null {
  const accepted =
    channel === "vendors"
      ? ["vendor", "wholesale", "promo", "special", "store"]
      : ["store", "promo", "special"];
  const candidates = prices
    .filter((p) => accepted.includes(p.priceType))
    .map((p) => p.amountUsd);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function floorFor(
  hasPricingAuthority: boolean,
  reference: number,
  cost: number,
): number {
  if (hasPricingAuthority) {
    return cost > 0
      ? cost
      : reference * (1 - PRICING_POLICY.managerMaxDiscountRatioWithoutCost);
  }
  return Math.max(reference * (1 - PRICING_POLICY.staffMaxDiscountRatio), cost);
}

/**
 * Returns whether every line is within policy. Throws for lines that can never
 * be sold: unknown or inactive products, products without a price, and net
 * prices at or below zero.
 */
export async function isOrderPricingWithinPolicy(
  ctx: PricingContext,
  channel: SalesChannel,
  items: readonly PricedLine[],
): Promise<boolean> {
  const workspaceId = ctx.workspace.workspaceId;
  const productIds = [...new Set(items.map((i) => i.productId))];

  const products = await ctx.db
    .select({
      id: Product.id,
      status: Product.status,
      costAvg: Product.costAvg,
    })
    .from(Product)
    .where(
      and(
        eq(Product.workspaceId, workspaceId),
        inArray(Product.id, productIds),
      ),
    );
  if (products.length !== productIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Uno o más productos no pertenecen al catálogo de este negocio",
    });
  }
  if (products.some((p) => UNSELLABLE_STATUSES.includes(String(p.status)))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "No se pueden vender productos en estado borrador o descontinuado",
    });
  }

  const priceRows = await ctx.db
    .select({
      productId: ProductPrice.productId,
      priceType: ProductPrice.priceType,
      amountUsd: ProductPrice.amountUsd,
    })
    .from(ProductPrice)
    .where(
      and(
        eq(ProductPrice.workspaceId, workspaceId),
        inArray(ProductPrice.productId, productIds),
      ),
    );

  const pricesByProduct = new Map<string, PriceRow[]>();
  for (const row of priceRows) {
    if (row.amountUsd <= 0) continue;
    const list = pricesByProduct.get(row.productId) ?? [];
    list.push({ priceType: row.priceType, amountUsd: row.amountUsd });
    pricesByProduct.set(row.productId, list);
  }
  const costByProduct = new Map(
    products.map((p) => [p.id, Number(p.costAvg ?? 0) || 0]),
  );

  const hasPricingAuthority = can(ctx.workspace.role, "pricing", "update");
  let withinPolicy = true;

  for (const item of items) {
    const netUnit = item.unitPrice - item.discount;
    if (item.unitPrice <= 0 || netUnit <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "El precio neto de cada artículo debe ser mayor a cero y el descuento no puede superar su precio",
      });
    }

    const reference = referencePrice(
      channel,
      pricesByProduct.get(item.productId) ?? [],
    );
    if (reference === null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Hay productos sin precio de catálogo: asígnales un precio antes de venderlos",
      });
    }

    const floor = floorFor(
      hasPricingAuthority,
      reference,
      costByProduct.get(item.productId) ?? 0,
    );
    if (netUnit < floor - MONEY_EPSILON) withinPolicy = false;
  }

  return withinPolicy;
}
