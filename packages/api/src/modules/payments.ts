/**
 * Cendaro — Payments Router
 *
 * Separated from sales.ts per Module/API Blueprint.
 * PRD §19: Payment processing, validation, and cash closure.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import {
  AccountReceivable,
  CashClosure,
  Payment,
  PaymentEvidence,
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

export const addPaymentInputSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(paymentMethodEnum.enumValues),
  amount: z.number().positive(),
  reference: z.string().max(128).optional(),
  bankName: z.string().max(128).optional(),
  payerName: z.string().max(256).optional(),
  payerIdDoc: z.string().max(32).optional(),
  evidenceUrl: z.string().url().max(2048).optional(),
  evidenceType: z.enum(["image", "pdf", "voucher"]).default("image").optional(),
  notes: z.string().optional(),
});

export const openShiftInputSchema = z.object({
  openingCashUsd: z.number().nonnegative().default(0),
  notes: z.string().max(500).optional(),
});

export const createClosureInputSchema = z.object({
  shiftId: z.string().uuid().optional(),
  closureDate: z.string().datetime(),
  totalSales: z.number().nonnegative().default(0),
  totalCash: z.number().nonnegative().default(0),
  totalDigital: z.number().nonnegative().default(0),
  expectedTotal: z.number().nonnegative().default(0),
  actualTotal: z.number().nonnegative(),
  notes: z.string().optional(),
});

export function getCaracasDateString(
  dateInput: Date | string = new Date(),
): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Caracas",
    });
  }
  return d.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

export function getCaracasDayBounds(dateInput: Date | string): {
  dateStr: string;
  startUtc: Date;
  endUtc: Date;
} {
  const dateStr =
    typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? dateInput
      : getCaracasDateString(dateInput);
  const startUtc = new Date(`${dateStr}T00:00:00.000-04:00`);
  const endUtc = new Date(`${dateStr}T23:59:59.999-04:00`);
  return { dateStr, startUtc, endUtc };
}

export async function executeListPayments(
  db: DbClient,
  workspaceId: string,
  input: { limit: number; onlyPending?: boolean },
) {
  const conditions = [eq(Payment.workspaceId, workspaceId)];
  if (input.onlyPending) {
    conditions.push(eq(Payment.isValidated, false));
  }

  return db
    .select({
      id: Payment.id,
      orderId: Payment.orderId,
      method: Payment.method,
      amount: Payment.amount,
      reference: Payment.reference,
      evidenceUrl: Payment.evidenceUrl,
      isValidated: Payment.isValidated,
      payerName: Payment.payerName,
      bankName: Payment.bankName,
      createdAt: Payment.createdAt,
    })
    .from(Payment)
    .where(and(...conditions))
    .orderBy(desc(Payment.createdAt))
    .limit(input.limit);
}

export async function executeAddPayment(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  input: z.infer<typeof addPaymentInputSchema>,
) {
  if (input.reference) {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`payment_ref:${workspaceId}:${input.orderId}:${input.reference}`}, 0))`,
    );
  }

  const [order] = await db
    .select()
    .from(SalesOrder)
    .where(
      and(
        eq(SalesOrder.id, input.orderId),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Order not found in this workspace",
    });
  }

  const { evidenceType, ...paymentValues } = input;
  const [payment] = await db
    .insert(Payment)
    .values({
      ...paymentValues,
      workspaceId,
    })
    .returning();

  if (input.evidenceUrl && payment?.id) {
    await db.insert(PaymentEvidence).values({
      workspaceId,
      paymentId: payment.id,
      evidenceUrl: input.evidenceUrl,
      evidenceType: evidenceType ?? "image",
      uploadedBy: user.id,
    });
  }

  await db
    .update(SalesOrder)
    .set({
      totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
    })
    .where(
      and(
        eq(SalesOrder.id, input.orderId),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    );

  // SEC-API-015: Synchronize linked AccountReceivable balance when present
  const [ar] = await db
    .select()
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.orderId, input.orderId),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (ar && typeof ar.balance === "number" && ar.balance > 0) {
    const newPaid = Number((ar.paidAmount + input.amount).toFixed(2));
    const newBalance = Math.max(
      0,
      Number((ar.balance - input.amount).toFixed(2)),
    );
    await db
      .update(AccountReceivable)
      .set({
        paidAmount: newPaid,
        balance: newBalance,
        status: newBalance <= 0.009 ? "paid" : "partial",
      })
      .where(
        and(
          eq(AccountReceivable.id, ar.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
  }

  await logAudit(db, user, {
    workspaceId,
    action: "payment.create",
    entity: "payment",
    entityId: payment?.id,
    newValue: {
      method: input.method,
      amount: input.amount,
      hasEvidence: Boolean(input.evidenceUrl),
    },
  });

  return payment;
}

export async function executeValidatePayment(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  role: string,
  id: string,
) {
  if (!["owner", "admin", "supervisor"].includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient permissions to validate payments",
    });
  }

  const [updated] = await db
    .update(Payment)
    .set({ isValidated: true, validatedBy: user.id })
    .where(and(eq(Payment.id, id), eq(Payment.workspaceId, workspaceId)))
    .returning();

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Payment not found in this workspace",
    });
  }

  await logAudit(db, user, {
    workspaceId,
    action: "payment.validate",
    entity: "payment",
    entityId: id,
  });

  return updated;
}

export async function executeListClosures(db: DbClient, workspaceId: string) {
  return db
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
      notes: CashClosure.notes,
      closedBy: CashClosure.closedBy,
    })
    .from(CashClosure)
    .where(eq(CashClosure.workspaceId, workspaceId))
    .orderBy(desc(CashClosure.closureDate))
    .limit(100);
}

export async function executeOpenShift(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  input: z.infer<typeof openShiftInputSchema>,
) {
  const openingCash = Number(input.openingCashUsd.toFixed(2));
  const shiftNotes = input.notes
    ? `[Fondo Inicial: $${openingCash.toFixed(2)}] ${input.notes}`
    : `[Fondo Inicial: $${openingCash.toFixed(2)}]`;

  const [shift] = await db
    .insert(CashClosure)
    .values({
      workspaceId,
      closureDate: new Date(),
      status: "open",
      totalSales: 0,
      totalCash: openingCash,
      totalDigital: 0,
      expectedTotal: openingCash,
      actualTotal: openingCash,
      discrepancy: 0,
      notes: shiftNotes,
      closedBy: user.id,
    })
    .returning();

  await logAudit(db, user, {
    workspaceId,
    action: "cash.shift_open",
    entity: "cash_closure",
    entityId: shift?.id,
    newValue: {
      openingCashUsd: openingCash,
      notes: shiftNotes,
    },
  });

  return shift;
}

export async function executeComputeDailyClosureTotals(
  db: DbClient,
  workspaceId: string,
  closureDate: Date | string,
) {
  const { dateStr, startUtc, endUtc } = getCaracasDayBounds(closureDate);

  const [salesAggRows, paymentsAggRows] = await Promise.all([
    db
      .select({
        totalSales: sql<number>`coalesce(sum(${SalesOrder.total}), 0)`,
      })
      .from(SalesOrder)
      .where(
        and(
          eq(SalesOrder.workspaceId, workspaceId),
          sql`${SalesOrder.status} != 'cancelled'`,
          sql`${SalesOrder.createdAt} >= ${startUtc} AND ${SalesOrder.createdAt} <= ${endUtc}`,
        ),
      ),
    db
      .select({
        totalCash: sql<number>`coalesce(sum(${Payment.amount}) filter (where ${Payment.method} = 'cash'), 0)`,
        totalDigital: sql<number>`coalesce(sum(${Payment.amount}) filter (where ${Payment.method} != 'cash'), 0)`,
      })
      .from(Payment)
      .where(
        and(
          eq(Payment.workspaceId, workspaceId),
          sql`${Payment.createdAt} >= ${startUtc} AND ${Payment.createdAt} <= ${endUtc}`,
        ),
      ),
  ]);

  const totalSales = Number(
    Number(salesAggRows[0]?.totalSales ?? 0).toFixed(2),
  );
  const totalCash = Number(
    Number(paymentsAggRows[0]?.totalCash ?? 0).toFixed(2),
  );
  const totalDigital = Number(
    Number(paymentsAggRows[0]?.totalDigital ?? 0).toFixed(2),
  );
  const expectedTotal = Number((totalCash + totalDigital).toFixed(2));

  return {
    closureDate: dateStr,
    totalSales,
    totalCash,
    totalDigital,
    expectedTotal,
  };
}

export async function executeCreateClosure(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  input: z.infer<typeof createClosureInputSchema>,
) {
  const computed = await executeComputeDailyClosureTotals(
    db,
    workspaceId,
    input.closureDate,
  );

  // Use server-calculated totals if payments/sales exist in DB for that Caracas day;
  // otherwise fall back to client-supplied totals (e.g. manual entry or mock environments).
  const hasDbActivity = computed.expectedTotal > 0 || computed.totalSales > 0;
  const totalSales = hasDbActivity ? computed.totalSales : input.totalSales;
  const totalCash = hasDbActivity ? computed.totalCash : input.totalCash;
  const totalDigital = hasDbActivity
    ? computed.totalDigital
    : input.totalDigital;
  const expectedTotal =
    computed.expectedTotal > 0 ? computed.expectedTotal : input.expectedTotal;
  const discrepancy = Number((input.actualTotal - expectedTotal).toFixed(2));

  if (input.shiftId) {
    const [closedShift] = await db
      .update(CashClosure)
      .set({
        closureDate: new Date(input.closureDate),
        status: "closed",
        totalSales,
        totalCash,
        totalDigital,
        expectedTotal,
        actualTotal: input.actualTotal,
        discrepancy,
        notes: input.notes,
        closedBy: user.id,
      })
      .where(
        and(
          eq(CashClosure.id, input.shiftId),
          eq(CashClosure.workspaceId, workspaceId),
        ),
      )
      .returning();

    await logAudit(db, user, {
      workspaceId,
      action: "cash.close",
      entity: "cash_closure",
      entityId: closedShift?.id ?? input.shiftId,
      newValue: {
        expectedTotal,
        actualTotal: input.actualTotal,
        discrepancy,
        shiftId: input.shiftId,
      },
    });

    return closedShift;
  }

  const [closure] = await db
    .insert(CashClosure)
    .values({
      workspaceId,
      closureDate: new Date(input.closureDate),
      status: "closed",
      totalSales,
      totalCash,
      totalDigital,
      expectedTotal,
      actualTotal: input.actualTotal,
      discrepancy,
      notes: input.notes,
      closedBy: user.id,
    })
    .returning();

  await logAudit(db, user, {
    workspaceId,
    action: "cash.close",
    entity: "cash_closure",
    entityId: closure?.id,
    newValue: {
      expectedTotal,
      actualTotal: input.actualTotal,
      discrepancy,
    },
  });

  return closure;
}

export async function executeReviewClosure(
  db: DbClient,
  user: { id: string; email?: string | null },
  workspaceId: string,
  role: string,
  id: string,
) {
  if (!["owner", "admin", "supervisor"].includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient permissions to review cash closures",
    });
  }

  const [updated] = await db
    .update(CashClosure)
    .set({
      status: "reviewed",
      reviewedBy: user.id,
    })
    .where(
      and(eq(CashClosure.id, id), eq(CashClosure.workspaceId, workspaceId)),
    )
    .returning();

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cash closure not found in this workspace",
    });
  }

  await logAudit(db, user, {
    workspaceId,
    action: "cash.review",
    entity: "cash_closure",
    entityId: id,
  });

  return updated;
}

export const paymentsRouter = createTRPCRouter({
  // ─── Payments ──────────────────────────────────

  list: wsReadPermissionProcedure("payments", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        onlyPending: z.boolean().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      executeListPayments(ctx.db, ctx.workspace.workspaceId, input),
    ),

  add: wsPermissionProcedure("payments", "create")
    .input(addPaymentInputSchema)
    .mutation(({ ctx, input }) =>
      executeAddPayment(ctx.db, ctx.user, ctx.workspace.workspaceId, input),
    ),

  validate: wsPermissionProcedure("payments", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      executeValidatePayment(
        ctx.db,
        ctx.user,
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        input.id,
      ),
    ),

  // ─── Cash Closure ────────────────────────────────

  listClosures: wsReadPermissionProcedure("cash_closure", "read").query(
    ({ ctx }) => executeListClosures(ctx.db, ctx.workspace.workspaceId),
  ),

  openShift: wsPermissionProcedure("cash_closure", "create")
    .input(openShiftInputSchema)
    .mutation(({ ctx, input }) =>
      executeOpenShift(ctx.db, ctx.user, ctx.workspace.workspaceId, input),
    ),

  dailyClosurePreview: wsReadPermissionProcedure("cash_closure", "read")
    .input(z.object({ closureDate: z.string().min(1) }))
    .query(({ ctx, input }) =>
      executeComputeDailyClosureTotals(
        ctx.db,
        ctx.workspace.workspaceId,
        input.closureDate,
      ),
    ),

  createClosure: wsPermissionProcedure("cash_closure", "create")
    .input(createClosureInputSchema)
    .mutation(({ ctx, input }) =>
      executeCreateClosure(ctx.db, ctx.user, ctx.workspace.workspaceId, input),
    ),

  reviewClosure: wsPermissionProcedure("cash_closure", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      executeReviewClosure(
        ctx.db,
        ctx.user,
        ctx.workspace.workspaceId,
        ctx.workspace.role,
        input.id,
      ),
    ),
});
