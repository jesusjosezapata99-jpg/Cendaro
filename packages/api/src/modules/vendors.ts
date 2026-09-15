import { TRPCError } from "@trpc/server";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AccountReceivable,
  arStatusEnum,
  Customer,
  SalesOrder,
  VendorCommission,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  workspaceProcedure,
  workspaceReadProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const vendorRouter = createTRPCRouter({
  // ─── Vendor Commissions (PRD §16) ────────────

  myCommissions: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: VendorCommission.id,
          vendorId: VendorCommission.vendorId,
          orderId: VendorCommission.orderId,
          orderTotal: VendorCommission.orderTotal,
          commissionPct: VendorCommission.commissionPct,
          commissionAmount: VendorCommission.commissionAmount,
          isPaid: VendorCommission.isPaid,
          paidAt: VendorCommission.paidAt,
          createdAt: VendorCommission.createdAt,
        })
        .from(VendorCommission)
        .where(
          and(
            eq(VendorCommission.vendorId, ctx.user.id),
            eq(VendorCommission.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .orderBy(desc(VendorCommission.createdAt))
        .limit(input.limit);
    }),

  myOrders: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: SalesOrder.id,
          orderNumber: SalesOrder.orderNumber,
          customerId: SalesOrder.customerId,
          channel: SalesOrder.channel,
          status: SalesOrder.status,
          total: SalesOrder.total,
          totalPaid: SalesOrder.totalPaid,
          createdAt: SalesOrder.createdAt,
        })
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.createdBy, ctx.user.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .orderBy(desc(SalesOrder.createdAt))
        .limit(input.limit);
    }),

  myCustomers: workspaceReadProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: Customer.id,
        name: Customer.name,
        customerType: Customer.customerType,
        phone: Customer.phone,
        email: Customer.email,
      })
      .from(Customer)
      .where(
        and(
          eq(Customer.assignedVendorId, ctx.user.id),
          eq(Customer.workspaceId, ctx.workspace.workspaceId),
        ),
      )
      .orderBy(Customer.name)
      .limit(200);
  }),

  allCommissions: workspaceProcedure
    .input(
      z.object({
        vendorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tiene permisos para ver todas las comisiones",
        });
      }

      const conditions = [
        eq(VendorCommission.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.vendorId) {
        conditions.push(eq(VendorCommission.vendorId, input.vendorId));
      }

      return ctx.db
        .select({
          id: VendorCommission.id,
          vendorId: VendorCommission.vendorId,
          orderId: VendorCommission.orderId,
          orderTotal: VendorCommission.orderTotal,
          commissionPct: VendorCommission.commissionPct,
          commissionAmount: VendorCommission.commissionAmount,
          isPaid: VendorCommission.isPaid,
          paidAt: VendorCommission.paidAt,
          createdAt: VendorCommission.createdAt,
        })
        .from(VendorCommission)
        .where(and(...conditions))
        .orderBy(desc(VendorCommission.createdAt))
        .limit(input.limit);
    }),

  payCommission: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo supervisores o administradores pueden pagar comisiones",
        });
      }

      const [updated] = await ctx.db
        .update(VendorCommission)
        .set({ isPaid: true, paidAt: new Date() })
        .where(
          and(
            eq(VendorCommission.id, input.id),
            eq(VendorCommission.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comisión no encontrada",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "commission.pay",
        entity: "vendor_commission",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Accounts Receivable / CxC (PRD §17.3) ──

  listAR: workspaceProcedure
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
        status: z.enum(arStatusEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.customerId) {
        conditions.push(eq(AccountReceivable.customerId, input.customerId));
      }
      if (input.status) {
        conditions.push(eq(AccountReceivable.status, input.status));
      }

      return ctx.db
        .select({
          id: AccountReceivable.id,
          customerId: AccountReceivable.customerId,
          orderId: AccountReceivable.orderId,
          totalAmount: AccountReceivable.totalAmount,
          paidAmount: AccountReceivable.paidAmount,
          balance: AccountReceivable.balance,
          status: AccountReceivable.status,
          dueDate: AccountReceivable.dueDate,
          createdAt: AccountReceivable.createdAt,
        })
        .from(AccountReceivable)
        .where(and(...conditions))
        .orderBy(desc(AccountReceivable.dueDate))
        .limit(input.limit);
    }),

  arById: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: AccountReceivable.id,
          customerId: AccountReceivable.customerId,
          customerName: Customer.name,
          customerIdentification: Customer.identification,
          orderId: AccountReceivable.orderId,
          totalAmount: AccountReceivable.totalAmount,
          paidAmount: AccountReceivable.paidAmount,
          balance: AccountReceivable.balance,
          status: AccountReceivable.status,
          dueDate: AccountReceivable.dueDate,
          notes: AccountReceivable.notes,
          createdAt: AccountReceivable.createdAt,
        })
        .from(AccountReceivable)
        .leftJoin(
          Customer,
          and(
            eq(AccountReceivable.customerId, Customer.id),
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .where(
          and(
            eq(AccountReceivable.id, input.id),
            eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  overdueAR: workspaceReadProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: AccountReceivable.id,
        customerId: AccountReceivable.customerId,
        orderId: AccountReceivable.orderId,
        totalAmount: AccountReceivable.totalAmount,
        balance: AccountReceivable.balance,
        status: AccountReceivable.status,
        dueDate: AccountReceivable.dueDate,
        createdAt: AccountReceivable.createdAt,
      })
      .from(AccountReceivable)
      .where(
        and(
          eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
          eq(AccountReceivable.status, "pending"),
          lte(AccountReceivable.dueDate, new Date()),
        ),
      )
      .orderBy(AccountReceivable.dueDate)
      .limit(100);
  }),

  createAR: workspaceProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        orderId: z.string().uuid().optional(),
        totalAmount: z.number().positive(),
        dueDate: z.string().datetime(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify customer belongs to workspace
      const [cust] = await ctx.db
        .select({ id: Customer.id })
        .from(Customer)
        .where(
          and(
            eq(Customer.id, input.customerId),
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!cust) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente no encontrado en este espacio de trabajo",
        });
      }

      const [ar] = await ctx.db
        .insert(AccountReceivable)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          customerId: input.customerId,
          orderId: input.orderId,
          totalAmount: input.totalAmount,
          balance: input.totalAmount,
          dueDate: new Date(input.dueDate),
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "ar.create",
        entity: "account_receivable",
        entityId: ar?.id,
        newValue: { customerId: input.customerId, amount: input.totalAmount },
      });

      return ar;
    }),

  recordPayment: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().positive(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(AccountReceivable)
        .set({
          paidAmount: sql`${AccountReceivable.paidAmount} + ${input.amount}`,
          balance: sql`${AccountReceivable.balance} - ${input.amount}`,
        })
        .where(
          and(
            eq(AccountReceivable.id, input.id),
            eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
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
      if (updated.balance <= 0) {
        await ctx.db
          .update(AccountReceivable)
          .set({ status: "paid", balance: 0 })
          .where(
            and(
              eq(AccountReceivable.id, input.id),
              eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
            ),
          );
      } else if (updated.paidAmount > 0) {
        await ctx.db
          .update(AccountReceivable)
          .set({ status: "partial" })
          .where(
            and(
              eq(AccountReceivable.id, input.id),
              eq(AccountReceivable.workspaceId, ctx.workspace.workspaceId),
            ),
          );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "ar.payment",
        entity: "account_receivable",
        entityId: input.id,
        newValue: { amount: input.amount },
      });

      return updated;
    }),
});
