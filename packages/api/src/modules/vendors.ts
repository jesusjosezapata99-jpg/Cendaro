/**
 * Cendaro — Vendor Portal & AR Router
 *
 * Vendor commissions, accounts receivable (CxC).
 * PRD §16: vendor portal, trazability, commissions.
 * PRD §17: CxC, aging, alerts, credit blocking.
 */
import { z } from "zod/v4";
import { desc, eq, sql, and, lte } from "drizzle-orm";

import {
  VendorCommission,
  AccountReceivable,
  Customer,
  SalesOrder,
  arStatusEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const vendorRouter = createTRPCRouter({
  // ─── Vendor Commissions (PRD §16) ────────────

  myCommissions: protectedProcedure
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
        .where(eq(VendorCommission.vendorId, ctx.user.id))
        .orderBy(desc(VendorCommission.createdAt))
        .limit(input.limit);
    }),

  myOrders: protectedProcedure
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
        .where(eq(SalesOrder.createdBy, ctx.user.id))
        .orderBy(desc(SalesOrder.createdAt))
        .limit(input.limit);
    }),

  myCustomers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: Customer.id,
        name: Customer.name,
        customerType: Customer.customerType,
        phone: Customer.phone,
        email: Customer.email,
      })
      .from(Customer)
      .where(eq(Customer.assignedVendorId, ctx.user.id))
      .orderBy(Customer.name)
      .limit(200);
  }),

  allCommissions: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(
      z.object({
        vendorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db.select({
        id: VendorCommission.id,
        vendorId: VendorCommission.vendorId,
        orderId: VendorCommission.orderId,
        orderTotal: VendorCommission.orderTotal,
        commissionPct: VendorCommission.commissionPct,
        commissionAmount: VendorCommission.commissionAmount,
        isPaid: VendorCommission.isPaid,
        paidAt: VendorCommission.paidAt,
        createdAt: VendorCommission.createdAt,
      }).from(VendorCommission).$dynamic();
      if (input.vendorId) {
        query = query.where(eq(VendorCommission.vendorId, input.vendorId));
      }
      return query
        .orderBy(desc(VendorCommission.createdAt))
        .limit(input.limit);
    }),

  payCommission: roleRestrictedProcedure(["owner", "admin"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(VendorCommission)
        .set({ isPaid: true, paidAt: new Date() })
        .where(eq(VendorCommission.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "commission.pay",
        entity: "vendor_commission",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Accounts Receivable / CxC (PRD §17.3) ──

  listAR: protectedProcedure
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
        status: z.enum(arStatusEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db.select({
        id: AccountReceivable.id,
        customerId: AccountReceivable.customerId,
        orderId: AccountReceivable.orderId,
        totalAmount: AccountReceivable.totalAmount,
        paidAmount: AccountReceivable.paidAmount,
        balance: AccountReceivable.balance,
        status: AccountReceivable.status,
        dueDate: AccountReceivable.dueDate,
        createdAt: AccountReceivable.createdAt,
      }).from(AccountReceivable).$dynamic();
      if (input.customerId) {
        query = query.where(eq(AccountReceivable.customerId, input.customerId));
      }
      if (input.status) {
        query = query.where(eq(AccountReceivable.status, input.status));
      }
      return query
        .orderBy(desc(AccountReceivable.dueDate))
        .limit(input.limit);
    }),

  arById: protectedProcedure
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
        .leftJoin(Customer, eq(AccountReceivable.customerId, Customer.id))
        .where(eq(AccountReceivable.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  overdueAR: protectedProcedure.query(async ({ ctx }) => {
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
          eq(AccountReceivable.status, "pending"),
          lte(AccountReceivable.dueDate, new Date()),
        ),
      )
      .orderBy(AccountReceivable.dueDate)
      .limit(100);
  }),

  createAR: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
      const [ar] = await ctx.db
        .insert(AccountReceivable)
        .values({
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
        action: "ar.create",
        entity: "account_receivable",
        entityId: ar?.id,
        newValue: { customerId: input.customerId, amount: input.totalAmount },
      });

      return ar;
    }),

  recordPayment: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
        .where(eq(AccountReceivable.id, input.id))
        .returning();

      // Auto-update status based on balance
      if (updated && updated.balance <= 0) {
        await ctx.db
          .update(AccountReceivable)
          .set({ status: "paid", balance: 0 })
          .where(eq(AccountReceivable.id, input.id));
      } else if (updated && updated.paidAmount > 0) {
        await ctx.db
          .update(AccountReceivable)
          .set({ status: "partial" })
          .where(eq(AccountReceivable.id, input.id));
      }

      await logAudit(ctx.db, ctx.user, {
        action: "ar.payment",
        entity: "account_receivable",
        entityId: input.id,
        newValue: { amount: input.amount },
      });

      return updated;
    }),
});
