/**
 * Cendaro — Receivables (CxC) Router
 *
 * PRD §18: Accounts receivable, installments, payment allocation.
 * @see docs/architecture/module_api_blueprint_v1.md — Accounts Receivable
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AccountReceivable,
  ArInstallment,
  PaymentAllocation,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  workspaceProcedure,
  workspaceReadProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const receivablesRouter = createTRPCRouter({
  // ─── List all AR accounts ─────────────────────
  list: workspaceReadProcedure
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
      const conditions = [
        eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
      ];

      if (input.status) {
        conditions.push(eq(AccountReceivable.status, input.status));
      }

      return ctx.db
        .select()
        .from(AccountReceivable)
        .where(and(...conditions))
        .orderBy(desc(AccountReceivable.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get by ID with installments + allocations ─
  byId: workspaceReadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [receivable] = await ctx.db
        .select()
        .from(AccountReceivable)
        .where(
          and(
            eq(AccountReceivable.id, input.id),
            eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!receivable) return null;

      const [installments, allocations] = await Promise.all([
        ctx.db
          .select()
          .from(ArInstallment)
          .where(
            and(
              eq(ArInstallment.receivableId, input.id),
              eq(ArInstallment.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
        ctx.db
          .select()
          .from(PaymentAllocation)
          .where(
            and(
              eq(PaymentAllocation.receivableId, input.id),
              eq(PaymentAllocation.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
      ]);

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
      const [receivable] = await ctx.db
        .select({ id: AccountReceivable.id })
        .from(AccountReceivable)
        .where(
          and(
            eq(AccountReceivable.id, input.receivableId),
            eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!receivable) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Receivable account not found in this workspace",
        });
      }

      const created = await ctx.db
        .insert(ArInstallment)
        .values(
          input.installments.map((inst) => ({
            workspaceId: ctx.workspace.workspaceId,
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
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to mark installments as paid",
        });
      }

      const [updated] = await ctx.db
        .update(ArInstallment)
        .set({
          status: "paid",
          paidAt: new Date(),
        })
        .where(
          and(
            eq(ArInstallment.id, input.installmentId),
            eq(ArInstallment.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "receivable.installment.paid",
        entity: "ar_installment",
        entityId: input.installmentId,
      });

      return updated;
    }),

  // ─── Summary stats ────────────────────────────
  summary: workspaceReadProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalActive: sql<number>`count(*) filter (where ${AccountReceivable.status} = 'pending')`,
        totalOverdue: sql<number>`count(*) filter (where ${AccountReceivable.status} = 'overdue')`,
        totalAmount: sql<number>`coalesce(sum(${AccountReceivable.totalAmount}), 0)`,
        paidAmount: sql<number>`coalesce(sum(${AccountReceivable.paidAmount}), 0)`,
      })
      .from(AccountReceivable)
      .where(eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId));

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
