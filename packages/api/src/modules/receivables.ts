/**
 * Cendaro — Receivables (CxC) Router
 *
 * PRD §18: Accounts receivable, installments, payment allocation.
 * @see docs/architecture/module_api_blueprint_v1.md — Accounts Receivable
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import {
  AccountReceivable,
  ArInstallment,
  Customer,
  Payment,
  PaymentAllocation,
  paymentMethodEnum,
  SalesOrder,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

type DbClient = ReturnType<typeof getDb>;

export const recordArPaymentInputSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(paymentMethodEnum.enumValues).default("transfer").optional(),
  reference: z.string().max(128).optional(),
  notes: z.string().optional(),
});

export async function executeRecordArPayment(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  input: z.infer<typeof recordArPaymentInputSchema>,
) {
  const [updated] = await db
    .update(AccountReceivable)
    .set({
      paidAmount: sql`${AccountReceivable.paidAmount} + ${input.amount}`,
      balance: sql`GREATEST(0, ${AccountReceivable.balance} - ${input.amount})`,
    })
    .where(
      and(
        eq(AccountReceivable.id, input.id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cuenta por cobrar no encontrada",
    });
  }

  // Auto-update status based on balance
  if (Number(updated.balance) <= 0) {
    await db
      .update(AccountReceivable)
      .set({ status: "paid", balance: 0 })
      .where(
        and(
          eq(AccountReceivable.id, input.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
    updated.status = "paid";
    updated.balance = 0;
  } else if (Number(updated.paidAmount) > 0) {
    await db
      .update(AccountReceivable)
      .set({ status: "partial" })
      .where(
        and(
          eq(AccountReceivable.id, input.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
    updated.status = "partial";
  }

  if (updated.customerId) {
    await db
      .update(Customer)
      .set({
        balance: sql`GREATEST(0, COALESCE(${Customer.balance}, 0) - ${input.amount})`,
      })
      .where(
        and(
          eq(Customer.id, updated.customerId),
          eq(Customer.workspaceId, workspaceId),
        ),
      );
  }

  if (updated.orderId) {
    const [payment] = await db
      .insert(Payment)
      .values({
        workspaceId,
        orderId: updated.orderId,
        method: input.method ?? "transfer",
        amount: input.amount,
        reference: input.reference,
        notes: input.notes ?? "Abono a Cuenta por Cobrar",
        isValidated: true,
        validatedBy: user.id,
      })
      .returning();

    if (payment?.id) {
      await db.insert(PaymentAllocation).values({
        workspaceId,
        paymentId: payment.id,
        receivableId: updated.id,
        amount: input.amount,
      });
    }

    await db
      .update(SalesOrder)
      .set({
        totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
      })
      .where(
        and(
          eq(SalesOrder.id, updated.orderId),
          eq(SalesOrder.workspaceId, workspaceId),
        ),
      );
  }

  await logAudit(db, user, {
    workspaceId,
    action: "ar.payment",
    entity: "account_receivable",
    entityId: input.id,
    newValue: { amount: input.amount, orderId: updated.orderId },
  });

  return updated;
}

export const receivablesRouter = createTRPCRouter({
  // ─── List all AR accounts ─────────────────────
  list: wsReadPermissionProcedure("receivables", "read")
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
  byId: wsReadPermissionProcedure("receivables", "read")
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
  createInstallments: wsPermissionProcedure("receivables", "create")
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
        workspaceId: ctx.workspace.workspaceId,
        action: "receivable.installments.create",
        entity: "ar_installment",
        entityId: input.receivableId,
        newValue: { count: input.installments.length },
      });

      return created;
    }),

  // ─── Record payment against AR ────────────────
  recordPayment: wsPermissionProcedure("receivables", "update")
    .input(recordArPaymentInputSchema)
    .mutation(({ ctx, input }) =>
      executeRecordArPayment(
        ctx.db,
        ctx.user,
        ctx.workspace.workspaceId,
        input,
      ),
    ),

  // ─── Mark installment as paid ─────────────────
  markPaid: wsPermissionProcedure("receivables", "approve")
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
          paidAmount: sql`${ArInstallment.amount}`,
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

      if (updated.receivableId && Number(updated.amount) > 0) {
        await executeRecordArPayment(
          ctx.db,
          ctx.user,
          ctx.workspace.workspaceId,
          {
            id: updated.receivableId,
            amount: Number(updated.amount),
            notes: `Cuota #${updated.installmentNumber} liquidada`,
          },
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "receivable.installment.paid",
        entity: "ar_installment",
        entityId: input.installmentId,
      });

      return updated;
    }),

  // ─── Summary stats ────────────────────────────
  summary: wsReadPermissionProcedure("receivables", "read").query(
    async ({ ctx }) => {
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
    },
  ),
});
