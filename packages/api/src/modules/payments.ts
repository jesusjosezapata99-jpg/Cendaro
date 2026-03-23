/**
 * Cendaro — Payments Router
 *
 * Separated from sales.ts per Module/API Blueprint.
 * PRD §19: Payment processing, validation, and cash closure.
 */
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { closureStatusEnum } from "@cendaro/db/schema";
import {
  CashClosure,
  Payment,
  paymentMethodEnum,
  SalesOrder,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const paymentsRouter = createTRPCRouter({
  // ─── Payments ──────────────────────────────────

  list: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        onlyPending: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.onlyPending
        ? eq(Payment.isValidated, false)
        : undefined;

      return ctx.db
        .select({
          id: Payment.id,
          orderId: Payment.orderId,
          method: Payment.method,
          amount: Payment.amount,
          reference: Payment.reference,
          isValidated: Payment.isValidated,
          payerName: Payment.payerName,
          bankName: Payment.bankName,
          createdAt: Payment.createdAt,
        })
        .from(Payment)
        .where(where)
        .orderBy(desc(Payment.createdAt))
        .limit(input.limit);
    }),

  add: workspaceProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        method: z.enum(paymentMethodEnum.enumValues),
        amount: z.number().positive(),
        reference: z.string().max(128).optional(),
        bankName: z.string().max(128).optional(),
        payerName: z.string().max(256).optional(),
        payerIdDoc: z.string().max(32).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.db.insert(Payment).values(input).returning();

      await ctx.db
        .update(SalesOrder)
        .set({
          totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
        })
        .where(eq(SalesOrder.id, input.orderId));

      await logAudit(ctx.db, ctx.user, {
        action: "payment.create",
        entity: "payment",
        entityId: payment?.id,
        newValue: { method: input.method, amount: input.amount },
      });

      return payment;
    }),

  validate: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(Payment)
        .set({ isValidated: true, validatedBy: ctx.user.id })
        .where(eq(Payment.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "payment.validate",
        entity: "payment",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Cash Closure ────────────────────────────────

  listClosures: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: CashClosure.id,
        closureDate: CashClosure.closureDate,
        totalSales: CashClosure.totalSales,
        totalCash: CashClosure.totalCash,
        totalDigital: CashClosure.totalDigital,
        expectedTotal: CashClosure.expectedTotal,
        actualTotal: CashClosure.actualTotal,
        discrepancy: CashClosure.discrepancy,
        status: CashClosure.status,
      })
      .from(CashClosure)
      .orderBy(desc(CashClosure.closureDate))
      .limit(100);
  }),

  createClosure: workspaceProcedure
    .input(
      z.object({
        closureDate: z.string().datetime(),
        totalSales: z.number().nonnegative(),
        totalCash: z.number().nonnegative(),
        totalDigital: z.number().nonnegative(),
        expectedTotal: z.number().nonnegative(),
        actualTotal: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const discrepancy = input.actualTotal - input.expectedTotal;
      const [closure] = await ctx.db
        .insert(CashClosure)
        .values({
          closureDate: new Date(input.closureDate),
          totalSales: input.totalSales,
          totalCash: input.totalCash,
          totalDigital: input.totalDigital,
          expectedTotal: input.expectedTotal,
          actualTotal: input.actualTotal,
          discrepancy,
          notes: input.notes,
          closedBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "cash.close",
        entity: "cash_closure",
        entityId: closure?.id,
        newValue: {
          expectedTotal: input.expectedTotal,
          actualTotal: input.actualTotal,
          discrepancy,
        },
      });

      return closure;
    }),

  reviewClosure: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(CashClosure)
        .set({
          status: "reviewed" as (typeof closureStatusEnum.enumValues)[number],
          reviewedBy: ctx.user.id,
        })
        .where(eq(CashClosure.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "cash.review",
        entity: "cash_closure",
        entityId: input.id,
      });

      return updated;
    }),
});
