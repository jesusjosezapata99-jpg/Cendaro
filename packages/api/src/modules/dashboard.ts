/**
 * Cendaro — Dashboard & Alerts Router
 *
 * Executive KPIs, system alerts.
 * PRD §22: dashboard widgets, PRD §23: system alerts.
 */
import { and, count, desc, eq, inArray, lt, sql, sum } from "drizzle-orm";
import { z } from "zod/v4";

import type { UserRole } from "@cendaro/validators";
import {
  AccountReceivable,
  alertTypeEnum,
  CashClosure,
  Container,
  ExchangeRate,
  Payment,
  SalesOrder,
  SystemAlert,
} from "@cendaro/db/schema";
import { NAV_ROLE_RULES } from "@cendaro/validators";

import type { createTRPCContext } from "../trpc";
import {
  createTRPCRouter,
  workspaceProcedure,
  workspaceReadProcedure,
} from "../trpc";
import { logAudit } from "./audit";

// ── Short-lived dashboard cache (30s TTL) ──────────
const dashboardCache = new Map<string, { data: unknown; expiry: number }>();
const DASHBOARD_CACHE_TTL = 30_000; // 30 seconds

type Context = Awaited<ReturnType<typeof createTRPCContext>> & {
  workspace: { workspaceId: string };
};

// ──────────────────────────────────────────────
// dashboard.overview (PLAN-2026-09-DESIGN-SYSTEM §T3.1)
// ──────────────────────────────────────────────

export const dashboardPeriodSchema = z.enum(["7d", "30d", "90d", "12m"]);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

const DAY_MS = 86_400_000;

interface PeriodRange {
  since: Date;
  bucketUnit: "day" | "week" | "month";
}

/** 7d/30d bucket by day, 90d by week, 12m by month — keeps each series to a readable point count. */
export function periodToRange(period: DashboardPeriod): PeriodRange {
  const now = Date.now();
  switch (period) {
    case "7d":
      return { since: new Date(now - 7 * DAY_MS), bucketUnit: "day" };
    case "30d":
      return { since: new Date(now - 30 * DAY_MS), bucketUnit: "day" };
    case "90d":
      return { since: new Date(now - 90 * DAY_MS), bucketUnit: "week" };
    case "12m":
      return { since: new Date(now - 365 * DAY_MS), bucketUnit: "month" };
  }
}

function roleAllows(
  role: UserRole | null | undefined,
  rule: readonly UserRole[],
): boolean {
  return !!role && rule.includes(role);
}

/** Gross margin is a pricing-sensitive figure — gated exactly like the "Precios" nav entry, so employees never receive it. */
export function canViewGrossProfit(role: UserRole | null | undefined): boolean {
  return roleAllows(role, NAV_ROLE_RULES.pricing);
}

/** Receivables are gated exactly like the "CxC" nav entry, so employees never receive them. */
export function canViewReceivables(role: UserRole | null | undefined): boolean {
  return roleAllows(role, NAV_ROLE_RULES.accountsReceivable);
}

/**
 * There is no per-product minimum-stock column anywhere in the schema
 * (verified 2026-09, T3.1a) — "low stock" is this fixed threshold
 * everywhere it's computed, mirroring the one other place this concept
 * already exists (`getWarehouseDetail` in `./inventory.ts`). `min` stays
 * `null` in the payload until such a column exists; the UI shows "—".
 */
const LOW_STOCK_THRESHOLD = 5;

const EXCLUDED_ORDER_STATUSES = ["cancelled", "returned"] as const;

async function computeSales(ctx: Context, range: PeriodRange) {
  const { rows } = await ctx.db.execute<{
    bucket: string | Date;
    total: string;
    order_count: string;
  }>(sql`
    SELECT date_trunc(${range.bucketUnit}, created_at) AS bucket,
           COALESCE(SUM(total), 0)::text AS total,
           COUNT(*)::text AS order_count
    FROM sales_order
    WHERE workspace_id = ${ctx.workspace.workspaceId}
      AND created_at >= ${range.since.toISOString()}
      AND status::text NOT IN (${EXCLUDED_ORDER_STATUSES[0]}, ${EXCLUDED_ORDER_STATUSES[1]})
    GROUP BY bucket
    ORDER BY bucket
  `);

  const series = rows.map((r) => ({
    bucket: new Date(r.bucket),
    total: Number(r.total),
  }));
  const total = series.reduce((acc, s) => acc + s.total, 0);
  const orders = rows.reduce((acc, r) => acc + Number(r.order_count), 0);

  return { total, orders, series };
}

async function computeGrossProfit(ctx: Context, range: PeriodRange) {
  const { rows } = await ctx.db.execute<{
    bucket: string | Date;
    revenue: string;
    cost: string;
  }>(sql`
    SELECT date_trunc(${range.bucketUnit}, so.created_at) AS bucket,
           COALESCE(SUM(oi.line_total), 0)::text AS revenue,
           COALESCE(SUM(oi.quantity * p.cost_avg), 0)::text AS cost
    FROM order_item oi
    JOIN sales_order so ON so.id = oi.order_id
    JOIN product p ON p.id = oi.product_id
    WHERE oi.workspace_id = ${ctx.workspace.workspaceId}
      AND so.workspace_id = ${ctx.workspace.workspaceId}
      AND so.created_at >= ${range.since.toISOString()}
      AND so.status::text NOT IN (${EXCLUDED_ORDER_STATUSES[0]}, ${EXCLUDED_ORDER_STATUSES[1]})
    GROUP BY bucket
    ORDER BY bucket
  `);

  const series = rows.map((r) => ({
    bucket: new Date(r.bucket),
    total: Number(r.revenue) - Number(r.cost),
  }));
  const revenue = rows.reduce((acc, r) => acc + Number(r.revenue), 0);
  const cost = rows.reduce((acc, r) => acc + Number(r.cost), 0);
  const margin = revenue > 0 ? (revenue - cost) / revenue : 0;

  return { revenue, cost, margin, series };
}

async function computeReceivables(ctx: Context) {
  const now = new Date();

  const [row] = await ctx.db
    .select({
      count: count(AccountReceivable.id),
      total: sum(AccountReceivable.balance),
    })
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
        inArray(AccountReceivable.status, ["pending", "partial"]),
      ),
    );

  const [overdueRow] = await ctx.db
    .select({ count: count(AccountReceivable.id) })
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
        inArray(AccountReceivable.status, ["pending", "partial"]),
        lt(AccountReceivable.dueDate, now),
      ),
    );

  return {
    count: row?.count ?? 0,
    total: Number(row?.total ?? 0),
    overdueCount: overdueRow?.count ?? 0,
  };
}

async function computeLowStock(ctx: Context) {
  const { rows: topRows } = await ctx.db.execute<{
    name: string;
    qty: string;
  }>(sql`
    SELECT p.name, SUM(sl.quantity)::text AS qty
    FROM stock_ledger sl
    JOIN product p ON p.id = sl.product_id
    WHERE sl.workspace_id = ${ctx.workspace.workspaceId}
    GROUP BY sl.product_id, p.name
    HAVING SUM(sl.quantity) > 0 AND SUM(sl.quantity) <= ${LOW_STOCK_THRESHOLD}
    ORDER BY qty ASC
    LIMIT 5
  `);

  const {
    rows: [countRow],
  } = await ctx.db.execute<{ total: string }>(sql`
    SELECT COUNT(*)::text AS total FROM (
      SELECT sl.product_id
      FROM stock_ledger sl
      WHERE sl.workspace_id = ${ctx.workspace.workspaceId}
      GROUP BY sl.product_id
      HAVING SUM(sl.quantity) > 0 AND SUM(sl.quantity) <= ${LOW_STOCK_THRESHOLD}
    ) low_stock_products
  `);

  return {
    count: Number(countRow?.total ?? 0),
    top: topRows.map((r) => ({ name: r.name, qty: Number(r.qty), min: null })),
  };
}

async function computePendingDispatch(ctx: Context) {
  const [row] = await ctx.db
    .select({ count: count(SalesOrder.id) })
    .from(SalesOrder)
    .where(
      and(
        eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
        inArray(SalesOrder.status, ["confirmed", "prepared"]),
      ),
    );

  return { count: row?.count ?? 0 };
}

async function computeRate(ctx: Context) {
  const rows = await ctx.db
    .select({ rate: ExchangeRate.rate })
    .from(ExchangeRate)
    .where(
      and(
        eq(ExchangeRate.workspaceId, ctx.workspace.workspaceId),
        eq(ExchangeRate.rateType, "bcv"),
      ),
    )
    .orderBy(desc(ExchangeRate.createdAt))
    .limit(2);

  const [latest, previous] = rows;
  const bcv = latest?.rate ?? 0;
  const changePct =
    latest && previous && previous.rate !== 0
      ? ((latest.rate - previous.rate) / previous.rate) * 100
      : 0;

  return { bcv, changePct };
}

async function computeTopProducts(ctx: Context, range: PeriodRange) {
  const { rows } = await ctx.db.execute<{
    name: string;
    qty: string;
    total: string;
  }>(sql`
    SELECT p.name,
           SUM(oi.quantity)::text AS qty,
           SUM(oi.line_total)::text AS total
    FROM order_item oi
    JOIN sales_order so ON so.id = oi.order_id
    JOIN product p ON p.id = oi.product_id
    WHERE oi.workspace_id = ${ctx.workspace.workspaceId}
      AND so.workspace_id = ${ctx.workspace.workspaceId}
      AND so.created_at >= ${range.since.toISOString()}
      AND so.status::text NOT IN (${EXCLUDED_ORDER_STATUSES[0]}, ${EXCLUDED_ORDER_STATUSES[1]})
    GROUP BY p.id, p.name
    ORDER BY SUM(oi.quantity) DESC
    LIMIT 5
  `);

  return rows.map((r) => ({
    name: r.name,
    qty: Number(r.qty),
    total: Number(r.total),
  }));
}

async function computeLastClosure(ctx: Context) {
  const [row] = await ctx.db
    .select({
      id: CashClosure.id,
      closureDate: CashClosure.closureDate,
      status: CashClosure.status,
      totalSales: CashClosure.totalSales,
      discrepancy: CashClosure.discrepancy,
    })
    .from(CashClosure)
    .where(eq(CashClosure.workspaceId, ctx.workspace.workspaceId))
    .orderBy(desc(CashClosure.closureDate))
    .limit(1);

  return row ?? null;
}

async function computeContainersInTransit(ctx: Context) {
  const [row] = await ctx.db
    .select({ count: count(Container.id) })
    .from(Container)
    .where(
      and(
        eq(Container.workspaceId, ctx.workspace.workspaceId),
        eq(Container.status, "in_transit"),
      ),
    );

  return { count: row?.count ?? 0 };
}

async function computeOverview(
  ctx: Context,
  period: DashboardPeriod,
  role: UserRole | null | undefined,
) {
  const range = periodToRange(period);

  const [
    sales,
    grossProfit,
    receivables,
    lowStock,
    pendingDispatch,
    rate,
    topProducts,
    lastClosure,
    containersInTransit,
  ] = await Promise.all([
    computeSales(ctx, range),
    canViewGrossProfit(role)
      ? computeGrossProfit(ctx, range)
      : Promise.resolve(null),
    canViewReceivables(role) ? computeReceivables(ctx) : Promise.resolve(null),
    computeLowStock(ctx),
    computePendingDispatch(ctx),
    computeRate(ctx),
    computeTopProducts(ctx, range),
    computeLastClosure(ctx),
    computeContainersInTransit(ctx),
  ]);

  return {
    sales,
    grossProfit,
    receivables,
    lowStock,
    pendingDispatch,
    rate,
    topProducts,
    lastClosure,
    containersInTransit,
  };
}

export type DashboardOverview = Awaited<ReturnType<typeof computeOverview>>;

async function computeSalesSummary(ctx: Context) {
  const safeQuery = async <T>(
    label: string,
    fn: () => Promise<T[]>,
    fallback: T,
  ): Promise<T> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const [row] = await fn();
        return row ?? fallback;
      } catch (err) {
        if (attempt === 0) {
          ctx.log.warn(
            `Dashboard sub-query failed (retrying in 1s): ${label}`,
            { module: "dashboard", attempt },
            err,
          );
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          ctx.log.error(
            `Dashboard sub-query failed after retry: ${label}`,
            { module: "dashboard", attempt },
            err,
          );
          return fallback;
        }
      }
    }
    return fallback;
  };

  const [orderStats, paymentStats, arStats] = await Promise.all([
    safeQuery(
      "orders",
      () =>
        ctx.db
          .select({
            totalOrders: count(SalesOrder.id),
            totalRevenue: sum(SalesOrder.total),
            totalPaid: sum(SalesOrder.totalPaid),
          })
          .from(SalesOrder)
          .where(eq(SalesOrder.workspaceId, ctx.workspace.workspaceId)),
      { totalOrders: 0, totalRevenue: null, totalPaid: null },
    ),
    safeQuery(
      "payments",
      () =>
        ctx.db
          .select({
            totalPayments: count(Payment.id),
            totalCollected: sum(Payment.amount),
          })
          .from(Payment)
          .where(eq(Payment.workspaceId, ctx.workspace.workspaceId)),
      { totalPayments: 0, totalCollected: null },
    ),
    safeQuery(
      "accounts_receivable",
      () =>
        ctx.db
          .select({
            totalAR: count(AccountReceivable.id),
            totalDebt: sum(AccountReceivable.balance),
          })
          .from(AccountReceivable)
          .where(
            and(
              eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
              eq(AccountReceivable.status, "pending"),
            ),
          ),
      { totalAR: 0, totalDebt: null },
    ),
  ]);

  return {
    orders: {
      total: orderStats.totalOrders,
      revenue: Number(orderStats.totalRevenue ?? 0),
      paid: Number(orderStats.totalPaid ?? 0),
    },
    payments: {
      total: paymentStats.totalPayments,
      collected: Number(paymentStats.totalCollected ?? 0),
    },
    accountsReceivable: {
      total: arStats.totalAR,
      debt: Number(arStats.totalDebt ?? 0),
    },
  };
}

export const dashboardRouter = createTRPCRouter({
  // ─── Overview (PLAN-2026-09-DESIGN-SYSTEM §T3.1) ──

  overview: workspaceReadProcedure
    .input(z.object({ period: dashboardPeriodSchema.default("30d") }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.user_metadata?.role;
      const cacheKey = `overview:${ctx.workspace.workspaceId}:${input.period}:${role ?? "none"}`;
      const cached = dashboardCache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        return cached.data as Awaited<ReturnType<typeof computeOverview>>;
      }

      const result = await computeOverview(ctx, input.period, role);
      dashboardCache.set(cacheKey, {
        data: result,
        expiry: Date.now() + DASHBOARD_CACHE_TTL,
      });
      return result;
    }),

  // ─── KPI Summary (PRD §22) ──────────────────

  salesSummary: workspaceReadProcedure.query(async ({ ctx }) => {
    const cacheKey = ctx.workspace.workspaceId;
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as Awaited<ReturnType<typeof computeSalesSummary>>;
    }

    const result = await computeSalesSummary(ctx);
    dashboardCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + DASHBOARD_CACHE_TTL,
    });
    return result;
  }),

  latestClosures: workspaceReadProcedure
    .input(z.object({ limit: z.number().int().min(1).max(7).default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: CashClosure.id,
          closureDate: CashClosure.closureDate,
          totalSales: CashClosure.totalSales,
          totalCash: CashClosure.totalCash,
          totalDigital: CashClosure.totalDigital,
          expectedTotal: CashClosure.expectedTotal,
          actualTotal: CashClosure.actualTotal,
          status: CashClosure.status,
        })
        .from(CashClosure)
        .where(eq(CashClosure.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(CashClosure.closureDate))
        .limit(input.limit);
    }),

  // ─── System Alerts (PRD §23) ─────────────────

  listAlerts: workspaceReadProcedure
    .input(
      z.object({
        alertType: z.enum(alertTypeEnum.enumValues).optional(),
        dismissed: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(SystemAlert.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.alertType) {
        conditions.push(eq(SystemAlert.alertType, input.alertType));
      }
      if (input.dismissed !== undefined) {
        conditions.push(eq(SystemAlert.isDismissed, input.dismissed));
      }

      return ctx.db
        .select({
          id: SystemAlert.id,
          alertType: SystemAlert.alertType,
          title: SystemAlert.title,
          message: SystemAlert.message,
          severity: SystemAlert.severity,
          isDismissed: SystemAlert.isDismissed,
          createdAt: SystemAlert.createdAt,
        })
        .from(SystemAlert)
        .where(and(...conditions))
        .orderBy(desc(SystemAlert.createdAt))
        .limit(input.limit);
    }),

  activeAlertCount: workspaceReadProcedure.query(async ({ ctx }) => {
    try {
      const [result] = await ctx.db
        .select({ count: count(SystemAlert.id) })
        .from(SystemAlert)
        .where(
          and(
            eq(SystemAlert.workspaceId, ctx.workspace.workspaceId),
            eq(SystemAlert.isDismissed, false),
          ),
        );
      return result?.count ?? 0;
    } catch (error) {
      ctx.log.warn(
        "activeAlertCount query fell back to 0",
        { workspaceId: ctx.workspace.workspaceId },
        error,
      );
      return 0;
    }
  }),

  dismissAlert: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(SystemAlert)
        .set({
          isDismissed: true,
          dismissedBy: ctx.user.id,
          dismissedAt: new Date(),
        })
        .where(
          and(
            eq(SystemAlert.id, input.id),
            eq(SystemAlert.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "alert.dismiss",
        entity: "system_alert",
        entityId: input.id,
      });

      return updated;
    }),

  dismissAllByType: workspaceProcedure
    .input(z.object({ alertType: z.enum(alertTypeEnum.enumValues) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(SystemAlert)
        .set({
          isDismissed: true,
          dismissedBy: ctx.user.id,
          dismissedAt: new Date(),
        })
        .where(
          and(
            eq(SystemAlert.workspaceId, ctx.workspace.workspaceId),
            eq(SystemAlert.alertType, input.alertType),
            eq(SystemAlert.isDismissed, false),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        action: "alert.dismiss_all",
        entity: "system_alert",
        newValue: { alertType: input.alertType },
      });

      return result;
    }),
});
