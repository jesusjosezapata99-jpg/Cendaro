/**
 * Cendaro — Reporting Router
 *
 * PRD §22: Report generation for sales, inventory, and financial data.
 * @see docs/architecture/module_api_blueprint_v1.md — Reporting & Exports
 */
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

import { Payment, SalesOrder, StockLedger } from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";

export const reportingRouter = createTRPCRouter({
  // ─── Sales summary by date range ──────────────
  salesSummary: protectedProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({
          totalOrders: sql<number>`count(*)`,
          totalRevenue: sql<number>`coalesce(sum(${SalesOrder.total}), 0)`,
          avgOrderValue: sql<number>`coalesce(avg(${SalesOrder.total}), 0)`,
        })
        .from(SalesOrder)
        .where(
          sql`${SalesOrder.createdAt} >= ${new Date(input.from)} AND ${SalesOrder.createdAt} <= ${new Date(input.to)}`,
        );

      return result ?? { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
    }),

  // ─── Sales by channel ─────────────────────────
  salesByChannel: protectedProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          channel: SalesOrder.channel,
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${SalesOrder.total}), 0)`,
        })
        .from(SalesOrder)
        .where(
          sql`${SalesOrder.createdAt} >= ${new Date(input.from)} AND ${SalesOrder.createdAt} <= ${new Date(input.to)}`,
        )
        .groupBy(SalesOrder.channel);
    }),

  // ─── Payment method breakdown ─────────────────
  paymentMethods: protectedProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          method: Payment.method,
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${Payment.amount}), 0)`,
        })
        .from(Payment)
        .where(
          sql`${Payment.createdAt} >= ${new Date(input.from)} AND ${Payment.createdAt} <= ${new Date(input.to)}`,
        )
        .groupBy(Payment.method);
    }),

  // ─── Inventory valuation ──────────────────────
  inventoryValuation: roleRestrictedProcedure([
    "owner",
    "admin",
    "supervisor",
  ]).query(async ({ ctx }) => {
    return ctx.db
      .select({
        warehouseId: StockLedger.warehouseId,
        totalProducts: sql<number>`count(distinct ${StockLedger.productId})`,
        totalUnits: sql<number>`coalesce(sum(${StockLedger.quantity}), 0)`,
      })
      .from(StockLedger)
      .groupBy(StockLedger.warehouseId);
  }),

  // ─── Top selling products ─────────────────────
  topProducts: protectedProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Uses raw SQL for join performance
      return ctx.db.execute(
        sql`
          SELECT oi.product_id,
                 p.name AS product_name,
                 p.sku,
                 SUM(oi.quantity) AS total_qty,
                 SUM(oi.line_total) AS total_revenue
          FROM order_item oi
          JOIN sales_order so ON oi.order_id = so.id
          JOIN product p ON oi.product_id = p.id
          WHERE so.created_at >= ${new Date(input.from)}
            AND so.created_at <= ${new Date(input.to)}
            AND so.status NOT IN ('cancelled')
          GROUP BY oi.product_id, p.name, p.sku
          ORDER BY total_qty DESC
          LIMIT ${input.limit}
        `,
      );
    }),
});
