/**
 * Cendaro — Reporting Router
 *
 * PRD §22: Report generation for sales, inventory, and financial data.
 * @see docs/architecture/module_api_blueprint_v1.md — Reporting & Exports
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AccountReceivable,
  OrderItem,
  Payment,
  Product,
  SalesOrder,
  StockLedger,
  Warehouse,
} from "@cendaro/db/schema";

import { createTRPCRouter, wsReadPermissionProcedure } from "../trpc";

const dateRangeInput = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export const reportingRouter = createTRPCRouter({
  // ─── Sales summary by date range ──────────────
  salesSummary: wsReadPermissionProcedure("dashboard", "export")
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({
          totalOrders: sql<number>`count(*)`,
          totalRevenue: sql<number>`coalesce(sum(${SalesOrder.total}), 0)`,
          avgOrderValue: sql<number>`coalesce(avg(${SalesOrder.total}), 0)`,
        })
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
            sql`${SalesOrder.status} NOT IN ('cancelled')`,
            sql`${SalesOrder.createdAt} >= ${new Date(input.from)} AND ${SalesOrder.createdAt} <= ${new Date(input.to)}`,
          ),
        );

      return result ?? { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
    }),

  // ─── Sales by channel ─────────────────────────
  salesByChannel: wsReadPermissionProcedure("dashboard", "export")
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          channel: SalesOrder.channel,
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${SalesOrder.total}), 0)`,
        })
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
            sql`${SalesOrder.status} NOT IN ('cancelled')`,
            sql`${SalesOrder.createdAt} >= ${new Date(input.from)} AND ${SalesOrder.createdAt} <= ${new Date(input.to)}`,
          ),
        )
        .groupBy(SalesOrder.channel);
    }),

  // ─── Payment method breakdown ─────────────────
  paymentMethods: wsReadPermissionProcedure("dashboard", "export")
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          method: Payment.method,
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${Payment.amount}), 0)`,
        })
        .from(Payment)
        .where(
          and(
            eq(Payment.workspaceId, ctx.workspace.workspaceId),
            sql`${Payment.createdAt} >= ${new Date(input.from)} AND ${Payment.createdAt} <= ${new Date(input.to)}`,
          ),
        )
        .groupBy(Payment.method);
    }),

  // ─── Inventory valuation ──────────────────────
  inventoryValuation: wsReadPermissionProcedure("dashboard", "export").query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          warehouseId: StockLedger.warehouseId,
          warehouseName: Warehouse.name,
          totalProducts: sql<number>`count(distinct ${StockLedger.productId})`,
          totalUnits: sql<number>`coalesce(sum(${StockLedger.quantity}), 0)`,
          totalCostValueUsd: sql<number>`coalesce(sum(${StockLedger.quantity} * CAST(coalesce(${Product.costAvg}, '0') AS double precision)), 0)`,
        })
        .from(StockLedger)
        .leftJoin(
          Warehouse,
          and(
            eq(StockLedger.warehouseId, Warehouse.id),
            eq(Warehouse.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .leftJoin(
          Product,
          and(
            eq(StockLedger.productId, Product.id),
            eq(Product.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .where(eq(StockLedger.workspaceId, ctx.workspace.workspaceId))
        .groupBy(StockLedger.warehouseId, Warehouse.name);
    },
  ),

  // ─── Top selling products ─────────────────────
  topProducts: wsReadPermissionProcedure("dashboard", "export")
    .input(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          productId: OrderItem.productId,
          productName: Product.name,
          sku: Product.sku,
          totalQty: sql<number>`coalesce(sum(${OrderItem.quantity}), 0)`,
          totalRevenue: sql<number>`coalesce(sum(${OrderItem.lineTotal}), 0)`,
        })
        .from(OrderItem)
        .innerJoin(
          SalesOrder,
          and(
            eq(OrderItem.orderId, SalesOrder.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .innerJoin(
          Product,
          and(
            eq(OrderItem.productId, Product.id),
            eq(Product.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .where(
          and(
            eq(OrderItem.workspaceId, ctx.workspace.workspaceId),
            sql`${SalesOrder.createdAt} >= ${new Date(input.from)} AND ${SalesOrder.createdAt} <= ${new Date(input.to)}`,
            sql`${SalesOrder.status} NOT IN ('cancelled')`,
          ),
        )
        .groupBy(OrderItem.productId, Product.name, Product.sku)
        .orderBy(desc(sql`coalesce(sum(${OrderItem.quantity}), 0)`))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        product_id: r.productId,
        product_name: r.productName,
        total_qty: Number(r.totalQty),
        total_revenue: Number(r.totalRevenue),
      }));
    }),

  // ─── Automated Ledger Reconciliation (SOC 1 ICFR) ───
  /**
   * Reconciles financial ledgers (Orders, Payments, Receivables) and verifies StockLedger consistency.
   * Restrict access to supervisor, admin, owner.
   */
  reconcileFinancialLedger: wsReadPermissionProcedure(
    "dashboard",
    "export",
  ).query(async ({ ctx }) => {
    if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Solo supervisores y administradores pueden ejecutar la conciliación financiera",
      });
    }

    // 1. Total sales revenue from confirmed orders (excluding cancelled)
    const [salesRow] = await ctx.db
      .select({
        totalRevenue: sql<string>`coalesce(sum(${SalesOrder.total}), '0')`,
        totalOrders: sql<number>`count(*)`,
      })
      .from(SalesOrder)
      .where(
        and(
          eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          sql`${SalesOrder.status} NOT IN ('cancelled')`,
        ),
      );

    // 2. Total payments collected
    const [paymentsRow] = await ctx.db
      .select({
        totalCollected: sql<string>`coalesce(sum(${Payment.amount}), '0')`,
        totalPayments: sql<number>`count(*)`,
      })
      .from(Payment)
      .where(eq(Payment.workspaceId, ctx.workspace.workspaceId));

    // 3. Outstanding accounts receivable balance
    const [arRow] = await ctx.db
      .select({
        totalOutstanding: sql<string>`coalesce(sum(${AccountReceivable.balance}), '0')`,
        totalInvoices: sql<number>`count(*)`,
      })
      .from(AccountReceivable)
      .where(
        and(
          eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
          sql`${AccountReceivable.status} IN ('pending', 'partial', 'overdue')`,
        ),
      );

    // 4. Inventory health: check for negative stock anomalies in StockLedger
    const [inventoryAnomalyRow] = await ctx.db
      .select({
        anomalyCount: sql<number>`count(*)`,
      })
      .from(StockLedger)
      .where(
        and(
          eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          sql`${StockLedger.quantity} < 0`,
        ),
      );

    const totalSales = parseFloat(salesRow?.totalRevenue ?? "0");
    const totalPayments = parseFloat(paymentsRow?.totalCollected ?? "0");
    const totalReceivables = parseFloat(arRow?.totalOutstanding ?? "0");

    // Theoretical balance equation: Total Sales = Total Payments Received + Outstanding Receivables
    // Any discrepancy indicates unrecorded payment, unrecorded receivable, or manual ledger tampering
    const discrepancy = Number(
      (totalSales - (totalPayments + totalReceivables)).toFixed(2),
    );
    const isBalanced = Math.abs(discrepancy) < 0.05; // 5 cents tolerance for floating point rounding

    const negativeStockCount = Number(inventoryAnomalyRow?.anomalyCount ?? 0);
    const isInventoryHealthy = negativeStockCount === 0;

    const complianceStatus =
      isBalanced && isInventoryHealthy
        ? "BALANCED_COMPLIANT"
        : "RECONCILIATION_REQUIRED";

    return {
      reconciledAt: new Date().toISOString(),
      workspaceId: ctx.workspace.workspaceId,
      complianceStandard: "SOC 1 / SSAE 18 ICFR",
      status: complianceStatus,
      financials: {
        totalSalesRevenue: totalSales,
        totalSalesOrders: salesRow?.totalOrders ?? 0,
        totalPaymentsCollected: totalPayments,
        totalPaymentsCount: paymentsRow?.totalPayments ?? 0,
        totalReceivablesOutstanding: totalReceivables,
        totalReceivablesCount: arRow?.totalInvoices ?? 0,
        discrepancy,
        isBalanced,
      },
      inventory: {
        negativeStockAnomalies: negativeStockCount,
        isHealthy: isInventoryHealthy,
      },
    };
  }),
});
