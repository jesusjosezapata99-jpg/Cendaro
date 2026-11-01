/**
 * Cendaro — Receivables (CxC) Router
 *
 * PRD §18: Accounts receivable, installments, payment allocation.
 * @see docs/architecture/module_api_blueprint_v1.md — Accounts Receivable
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import {
  AccountReceivable,
  ArInstallment,
  Payment,
  PaymentAllocation,
  paymentMethodEnum,
  SalesOrder,
} from "@cendaro/db/schema";
import { MONEY_EPSILON, roundMoney2 } from "@cendaro/validators";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

type DbClient = ReturnType<typeof getDb>;

const OPEN_RECEIVABLE_STATUSES: readonly string[] = [
  "pending",
  "partial",
  "overdue",
];

export const recordArPaymentInputSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(paymentMethodEnum.enumValues).default("transfer").optional(),
  reference: z.string().max(128).optional(),
  notes: z.string().optional(),
});

/** Spreads an amount over the receivable's unpaid installments, oldest first. */
async function applyToInstallments(
  db: DbClient,
  workspaceId: string,
  receivableId: string,
  amount: number,
): Promise<void> {
  const installments = await db
    .select()
    .from(ArInstallment)
    .where(
      and(
        eq(ArInstallment.receivableId, receivableId),
        eq(ArInstallment.workspaceId, workspaceId),
        ne(ArInstallment.status, "paid"),
      ),
    )
    .orderBy(asc(ArInstallment.dueDate), asc(ArInstallment.installmentNumber))
    .for("update");

  let remaining = amount;
  for (const installment of installments) {
    if (remaining <= MONEY_EPSILON) break;
    const owed = roundMoney2(
      Number(installment.amount) - Number(installment.paidAmount ?? 0),
    );
    const applied = Math.min(owed, remaining);
    const isPaid = applied >= owed - MONEY_EPSILON;
    await db
      .update(ArInstallment)
      .set({
        paidAmount: roundMoney2(Number(installment.paidAmount ?? 0) + applied),
        status: isPaid ? "paid" : "partially_paid",
        paidAt: isPaid ? new Date() : installment.paidAt,
      })
      .where(
        and(
          eq(ArInstallment.id, installment.id),
          eq(ArInstallment.workspaceId, workspaceId),
        ),
      );
    remaining = roundMoney2(remaining - applied);
  }
}

/**
 * Records a payment against a receivable. With an order, the payment row moves
 * the balance through trg_ar_payment, the single writer of that movement; a
 * receivable without an order has no payment row, so it is updated here.
 */
/**
 * Order first, then receivable: the same order as payments on an order, so the
 * two paths cannot deadlock.
 */
async function lockReceivable(db: DbClient, workspaceId: string, id: string) {
  const [reference] = await db
    .select({ orderId: AccountReceivable.orderId })
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.id, id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (reference?.orderId) {
    await db
      .select({ id: SalesOrder.id })
      .from(SalesOrder)
      .where(
        and(
          eq(SalesOrder.id, reference.orderId),
          eq(SalesOrder.workspaceId, workspaceId),
        ),
      )
      .limit(1)
      .for("update");
  }
  const [receivable] = await db
    .select()
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.id, id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");
  return receivable;
}

export async function executeRecordArPayment(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  input: z.infer<typeof recordArPaymentInputSchema>,
  options: { applyToInstallments?: boolean } = {},
) {
  const receivable = await lockReceivable(db, workspaceId, input.id);

  if (!receivable) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cuenta por cobrar no encontrada",
    });
  }
  if (!OPEN_RECEIVABLE_STATUSES.includes(receivable.status)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Esta cuenta por cobrar ya no tiene saldo abierto",
    });
  }
  if (input.amount > Number(receivable.balance) + MONEY_EPSILON) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `El abono ($${input.amount.toFixed(2)}) supera el saldo ($${Number(receivable.balance).toFixed(2)})`,
    });
  }

  if (receivable.orderId) {
    if (input.reference) {
      const [duplicate] = await db
        .select({ id: Payment.id })
        .from(Payment)
        .where(
          and(
            eq(Payment.workspaceId, workspaceId),
            eq(Payment.orderId, receivable.orderId),
            eq(Payment.reference, input.reference),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `La referencia ${input.reference} ya está registrada en este pedido`,
        });
      }
    }

    const [payment] = await db
      .insert(Payment)
      .values({
        workspaceId,
        orderId: receivable.orderId,
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
        receivableId: receivable.id,
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
          eq(SalesOrder.id, receivable.orderId),
          eq(SalesOrder.workspaceId, workspaceId),
        ),
      );
  } else {
    const balance = roundMoney2(Number(receivable.balance) - input.amount);
    await db
      .update(AccountReceivable)
      .set({
        paidAmount: roundMoney2(Number(receivable.paidAmount) + input.amount),
        balance: balance <= MONEY_EPSILON ? 0 : balance,
        status: balance <= MONEY_EPSILON ? "paid" : "partial",
      })
      .where(
        and(
          eq(AccountReceivable.id, receivable.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
  }

  if (options.applyToInstallments !== false) {
    await applyToInstallments(db, workspaceId, receivable.id, input.amount);
  }

  await logAudit(db, user, {
    workspaceId,
    action: "ar.payment",
    entity: "account_receivable",
    entityId: input.id,
    newValue: { amount: input.amount, orderId: receivable.orderId },
  });

  const [updated] = await db
    .select()
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.id, input.id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return updated ?? receivable;
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
      const workspaceId = ctx.workspace.workspaceId;
      const [reference] = await ctx.db
        .select({ receivableId: ArInstallment.receivableId })
        .from(ArInstallment)
        .where(
          and(
            eq(ArInstallment.id, input.installmentId),
            eq(ArInstallment.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (reference?.receivableId) {
        await lockReceivable(ctx.db, workspaceId, reference.receivableId);
      }

      const [current] = await ctx.db
        .select({
          amount: ArInstallment.amount,
          paidAmount: ArInstallment.paidAmount,
        })
        .from(ArInstallment)
        .where(
          and(
            eq(ArInstallment.id, input.installmentId),
            eq(ArInstallment.workspaceId, workspaceId),
            ne(ArInstallment.status, "paid"),
          ),
        )
        .limit(1)
        .for("update");

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuota no encontrada o ya pagada",
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
            eq(ArInstallment.workspaceId, workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuota no encontrada o ya pagada",
        });
      }

      // Only what the installment still owes: earlier partial payments count.
      const owed = roundMoney2(
        Number(current.amount) - Number(current.paidAmount ?? 0),
      );
      if (updated.receivableId && owed > 0) {
        await executeRecordArPayment(
          ctx.db,
          ctx.user,
          workspaceId,
          {
            id: updated.receivableId,
            amount: owed,
            notes: `Cuota #${updated.installmentNumber} liquidada`,
          },
          { applyToInstallments: false },
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
