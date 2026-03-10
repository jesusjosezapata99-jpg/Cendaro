/**
 * Cendaro — Dashboard & Alerts Router
 *
 * Executive KPIs, system alerts.
 * PRD §22: dashboard widgets, PRD §23: system alerts.
 */
import { and, count, desc, eq, sum } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AccountReceivable,
  alertTypeEnum,
  CashClosure,
  Payment,
  SalesOrder,
  SystemAlert,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const dashboardRouter = createTRPCRouter({
  // ─── KPI Summary (PRD §22) ──────────────────

  salesSummary: protectedProcedure.query(async ({ ctx }) => {
    // Each sub-query is wrapped individually so a single table failure
    // doesn't crash the entire dashboard endpoint (cascade prevention).
    // Single retry with 1s delay handles Supabase cold-start connection drops.
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
            .from(SalesOrder),
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
            .from(Payment),
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
            .where(eq(AccountReceivable.status, "pending")),
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
  }),

  latestClosures: protectedProcedure
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
        .orderBy(desc(CashClosure.closureDate))
        .limit(input.limit);
    }),

  // ─── System Alerts (PRD §23) ─────────────────

  listAlerts: protectedProcedure
    .input(
      z.object({
        alertType: z.enum(alertTypeEnum.enumValues).optional(),
        dismissed: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.alertType) {
        conditions.push(eq(SystemAlert.alertType, input.alertType));
      }
      if (input.dismissed !== undefined) {
        conditions.push(eq(SystemAlert.isDismissed, input.dismissed));
      }

      let query = ctx.db
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
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return query.orderBy(desc(SystemAlert.createdAt)).limit(input.limit);
    }),

  activeAlertCount: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db
      .select({ count: count(SystemAlert.id) })
      .from(SystemAlert)
      .where(eq(SystemAlert.isDismissed, false));
    return result?.count ?? 0;
  }),

  dismissAlert: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(SystemAlert)
        .set({
          isDismissed: true,
          dismissedBy: ctx.user.id,
          dismissedAt: new Date(),
        })
        .where(eq(SystemAlert.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "alert.dismiss",
        entity: "system_alert",
        entityId: input.id,
      });

      return updated;
    }),

  dismissAllByType: roleRestrictedProcedure(["owner", "admin"])
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
