/**
 * Cendaro — Payments Router
 *
 * Separated from sales.ts per Module/API Blueprint.
 * PRD §19: Payment processing, validation, and cash closure.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  CashClosure,
  Payment,
  paymentMethodEnum,
  SalesOrder,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const paymentsRouter = createTRPCRouter({
  // ─── Payments ──────────────────────────────────

  list: wsReadPermissionProcedure("payments", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        onlyPending: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Payment.workspaceId, ctx.workspace.workspaceId)];
      if (input.onlyPending) {
        conditions.push(eq(Payment.isValidated, false));
      }

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
        .where(and(...conditions))
        .orderBy(desc(Payment.createdAt))
        .limit(input.limit);
    }),

  add: wsPermissionProcedure("payments", "create")
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
      // Verify order belongs to current workspace
      const [order] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.id, input.orderId),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found in this workspace",
        });
      }

      const [payment] = await ctx.db
        .insert(Payment)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
        })
        .returning();

      await ctx.db
        .update(SalesOrder)
        .set({
          totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
        })
        .where(
          and(
            eq(SalesOrder.id, input.orderId),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        action: "payment.create",
        entity: "payment",
        entityId: payment?.id,
        newValue: { method: input.method, amount: input.amount },
      });

      return payment;
    }),

  validate: wsPermissionProcedure("payments", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to validate payments",
        });
      }

      const [updated] = await ctx.db
        .update(Payment)
        .set({ isValidated: true, validatedBy: ctx.user.id })
        .where(
          and(
            eq(Payment.id, input.id),
            eq(Payment.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "payment.validate",
        entity: "payment",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Cash Closure ────────────────────────────────

  listClosures: wsReadPermissionProcedure("cash_closure", "read").query(
    async ({ ctx }) => {
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
        .where(eq(CashClosure.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(CashClosure.closureDate))
        .limit(100);
    },
  ),

  createClosure: wsPermissionProcedure("cash_closure", "create")
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
          workspaceId: ctx.workspace.workspaceId,
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

  reviewClosure: wsPermissionProcedure("cash_closure", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to review cash closures",
        });
      }

      const [updated] = await ctx.db
        .update(CashClosure)
        .set({
          status: "reviewed",
          reviewedBy: ctx.user.id,
        })
        .where(
          and(
            eq(CashClosure.id, input.id),
            eq(CashClosure.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cash closure not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "cash.review",
        entity: "cash_closure",
        entityId: input.id,
      });

      return updated;
    }),
});
