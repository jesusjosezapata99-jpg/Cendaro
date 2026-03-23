/**
 * Cendaro — Sales Router
 *
 * Customers, orders, order items.
 * PRD §14-17: sales channels, order flow, customer management.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  CashClosure,
  ChannelAllocation,
  Customer,
  customerTypeEnum,
  OrderItem,
  orderStatusEnum,
  Payment,
  paymentMethodEnum,
  salesChannelEnum,
  SalesOrder,
  StockMovement,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const salesRouter = createTRPCRouter({
  // ─── Customers (PRD §17) ─────────────────────

  listCustomers: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        customerType: z.enum(customerTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: Customer.id,
          name: Customer.name,
          customerType: Customer.customerType,
          phone: Customer.phone,
          email: Customer.email,
          assignedVendorId: Customer.assignedVendorId,
          creditLimit: Customer.creditLimit,
          createdAt: Customer.createdAt,
        })
        .from(Customer)
        .$dynamic();
      if (input.customerType) {
        query = query.where(eq(Customer.customerType, input.customerType));
      }
      return query
        .orderBy(Customer.name)
        .limit(input.limit)
        .offset(input.offset);
    }),

  customerById: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [customer] = await ctx.db
        .select()
        .from(Customer)
        .where(eq(Customer.id, input.id))
        .limit(1);
      return customer ?? null;
    }),

  createCustomer: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        legalName: z.string().max(512).optional(),
        identification: z.string().max(32).optional(),
        customerType: z.enum(customerTypeEnum.enumValues).default("retail"),
        phone: z.string().max(32).optional(),
        email: z.email().optional(),
        address: z.string().optional(),
        creditLimit: z.number().nonnegative().optional(),
        creditDays: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db.insert(Customer).values(input).returning();
      await logAudit(ctx.db, ctx.user, {
        action: "customer.create",
        entity: "customer",
        entityId: c?.id,
        newValue: { name: input.name, type: input.customerType },
      });
      return c;
    }),

  // ─── Orders (PRD §14-16) ─────────────────────

  listOrders: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        status: z.enum(orderStatusEnum.enumValues).optional(),
        channel: z.enum(salesChannelEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: SalesOrder.id,
          orderNumber: SalesOrder.orderNumber,
          customerId: SalesOrder.customerId,
          channel: SalesOrder.channel,
          status: SalesOrder.status,
          subtotal: SalesOrder.subtotal,
          discount: SalesOrder.discount,
          total: SalesOrder.total,
          totalPaid: SalesOrder.totalPaid,
          createdAt: SalesOrder.createdAt,
        })
        .from(SalesOrder)
        .$dynamic();
      if (input.status) {
        query = query.where(eq(SalesOrder.status, input.status));
      }
      if (input.channel) {
        query = query.where(eq(SalesOrder.channel, input.channel));
      }
      return query
        .orderBy(desc(SalesOrder.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  orderById: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(eq(SalesOrder.id, input.id))
        .limit(1);

      if (!order) return null;

      const [items, payments] = await Promise.all([
        ctx.db.select().from(OrderItem).where(eq(OrderItem.orderId, input.id)),
        ctx.db.select().from(Payment).where(eq(Payment.orderId, input.id)),
      ]);

      return { ...order, items, payments };
    }),

  createOrder: workspaceProcedure
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
        channel: z.enum(salesChannelEnum.enumValues),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().nonnegative(),
            discount: z.number().nonnegative().default(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subtotal = input.items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );
      const totalDiscount = input.items.reduce(
        (sum, i) => sum + i.discount * i.quantity,
        0,
      );
      const total = subtotal - totalDiscount;

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const [order] = await ctx.db
        .insert(SalesOrder)
        .values({
          orderNumber,
          customerId: input.customerId,
          channel: input.channel,
          subtotal,
          discount: totalDiscount,
          total,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      if (order && input.items.length > 0) {
        await ctx.db.insert(OrderItem).values(
          input.items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: (item.unitPrice - item.discount) * item.quantity,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        action: "order.create",
        entity: "sales_order",
        entityId: order?.id,
        newValue: { orderNumber, channel: input.channel, total },
      });

      return order;
    }),

  updateOrderStatus: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(orderStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the current order before updating
      const [currentOrder] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(eq(SalesOrder.id, input.id))
        .limit(1);

      if (!currentOrder) throw new Error("Order not found");

      const [updated] = await ctx.db
        .update(SalesOrder)
        .set({ status: input.status })
        .where(eq(SalesOrder.id, input.id))
        .returning();

      // ── Stock lifecycle: deduct on close, revert on return/cancel ──
      const closingStatuses = ["delivered", "invoiced"] as const;
      const revertStatuses = ["returned", "cancelled"] as const;

      const isClosing =
        (closingStatuses as readonly string[]).includes(input.status) &&
        !currentOrder.stockDeducted;

      const isReverting =
        (revertStatuses as readonly string[]).includes(input.status) &&
        currentOrder.stockDeducted;

      if (isClosing || isReverting) {
        const items = await ctx.db
          .select()
          .from(OrderItem)
          .where(eq(OrderItem.orderId, input.id));

        for (const item of items) {
          const sign = isClosing ? -1 : 1;
          const movementType = isClosing ? "sale" : "return";

          await ctx.db
            .update(ChannelAllocation)
            .set({
              quantity: sql`GREATEST(quantity + ${sign * item.quantity}, 0)`,
            })
            .where(
              and(
                eq(ChannelAllocation.productId, item.productId),
                eq(ChannelAllocation.channel, currentOrder.channel),
              ),
            );

          await ctx.db.insert(StockMovement).values({
            productId: item.productId,
            movementType,
            quantity: sign * item.quantity,
            fromChannel: isClosing ? currentOrder.channel : undefined,
            toChannel: isReverting ? currentOrder.channel : undefined,
            createdBy: ctx.user.id,
            referenceId: input.id,
            referenceType: "sales_order",
          });
        }

        // Update the stockDeducted flag
        await ctx.db
          .update(SalesOrder)
          .set({ stockDeducted: isClosing })
          .where(eq(SalesOrder.id, input.id));
      }

      await logAudit(ctx.db, ctx.user, {
        action: `order.status_${input.status}`,
        entity: "sales_order",
        entityId: input.id,
        newValue: {
          status: input.status,
          stockDeducted:
            isClosing ||
            (currentOrder.stockDeducted &&
              !(revertStatuses as readonly string[]).includes(input.status)),
        },
      });

      return updated;
    }),

  // ─── Payments (PRD §19) ──────────────────────

  listPayments: workspaceProcedure
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

  addPayment: workspaceProcedure
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

      // Update totalPaid on order
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

  validatePayment: workspaceProcedure
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

  // ─── Cash Closure (PRD §19.6) ────────────────

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
          status: "reviewed",
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
