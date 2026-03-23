/**
 * Cendaro — Receivables (CxC) Router
 *
 * PRD §18: Accounts receivable, installments, payment allocation.
 * @see docs/architecture/module_api_blueprint_v1.md — Accounts Receivable
 */
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { installmentStatusEnum } from "@cendaro/db/schema";
import {
  AccountReceivable,
  ArInstallment,
  PaymentAllocation,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const receivablesRouter = createTRPCRouter({
  // ─── List all AR accounts ─────────────────────
  list: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        status: z
          .enum(["pending", "partial", "paid", "overdue", "written_off"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db.select().from(AccountReceivable).$dynamic();

      if (input.status) {
        query = query.where(eq(AccountReceivable.status, input.status));
      }

      return query
        .orderBy(desc(AccountReceivable.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get by ID with installments + allocations ─
  byId: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [receivable] = await ctx.db
        .select()
        .from(AccountReceivable)
        .where(eq(AccountReceivable.id, input.id))
        .limit(1);

      if (!receivable) return null;

      const installments = await ctx.db
        .select()
        .from(ArInstallment)
        .where(eq(ArInstallment.receivableId, input.id));

      const allocations = await ctx.db
        .select()
        .from(PaymentAllocation)
        .where(eq(PaymentAllocation.receivableId, input.id));

      return { ...receivable, installments, allocations };
    }),

  // ─── Create installments for AR ───────────────
  createInstallments: workspaceProcedure
    .input(
      z.object({
        receivableId: z.string().uuid(),
        installments: z.array(
          z.object({
            installmentNumber: z.number().int().min(1),
            amount: z.number().positive(),
            dueDate: z.string().datetime(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db
        .insert(ArInstallment)
        .values(
          input.installments.map((inst) => ({
            receivableId: input.receivableId,
            installmentNumber: inst.installmentNumber,
            amount: inst.amount,
            dueDate: new Date(inst.dueDate),
          })),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "receivable.installments.create",
        entity: "ar_installment",
        entityId: input.receivableId,
        newValue: { count: input.installments.length },
      });

      return created;
    }),

  // ─── Mark installment as paid ─────────────────
  markPaid: workspaceProcedure
    .input(
      z.object({
        installmentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(ArInstallment)
        .set({
          status: "paid" as (typeof installmentStatusEnum.enumValues)[number],
          paidAt: new Date(),
        })
        .where(eq(ArInstallment.id, input.installmentId))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "receivable.installment.paid",
        entity: "ar_installment",
        entityId: input.installmentId,
      });

      return updated;
    }),

  // ─── Summary stats ────────────────────────────
  summary: workspaceProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalActive: sql<number>`count(*) filter (where ${AccountReceivable.status} = 'pending')`,
        totalOverdue: sql<number>`count(*) filter (where ${AccountReceivable.status} = 'overdue')`,
        totalAmount: sql<number>`coalesce(sum(${AccountReceivable.totalAmount}), 0)`,
        paidAmount: sql<number>`coalesce(sum(${AccountReceivable.paidAmount}), 0)`,
      })
      .from(AccountReceivable);

    return (
      stats ?? {
        totalActive: 0,
        totalOverdue: 0,
        totalAmount: 0,
        paidAmount: 0,
      }
    );
  }),
});
