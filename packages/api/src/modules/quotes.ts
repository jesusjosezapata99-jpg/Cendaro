/**
 * Cendaro — Quotes Router
 *
 * PRD §15: Quotation management — create, convert to order, lifecycle.
 * @see docs/architecture/module_api_blueprint_v1.md — Sales & Documents
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";

import {
  Customer,
  OrderItem,
  Product,
  Quote,
  QuoteItem,
  quoteStatusEnum,
  salesChannelEnum,
  SalesOrder,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import { assertVendorCustomer, vendorScopeId } from "./vendor-scope";

export const quotesRouter = createTRPCRouter({
  list: wsReadPermissionProcedure("orders", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        status: z.enum(quoteStatusEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Quote.workspaceId, ctx.workspace.workspaceId)];
      const vendorId = vendorScopeId(ctx);
      if (vendorId) {
        conditions.push(eq(Quote.createdBy, vendorId));
      }
      if (input.status) {
        conditions.push(eq(Quote.status, input.status));
      }

      return ctx.db
        .select({
          id: Quote.id,
          quoteNumber: Quote.quoteNumber,
          customerId: Quote.customerId,
          customerName: Customer.name,
          customerIdentification: Customer.identification,
          status: Quote.status,
          channel: Quote.channel,
          total: Quote.total,
          validUntil: Quote.validUntil,
          createdAt: Quote.createdAt,
        })
        .from(Quote)
        .leftJoin(
          Customer,
          and(
            eq(Quote.customerId, Customer.id),
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(Quote.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  byId: wsReadPermissionProcedure("orders", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendorId = vendorScopeId(ctx);
      const [quote] = await ctx.db
        .select()
        .from(Quote)
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
            vendorId ? eq(Quote.createdBy, vendorId) : undefined,
          ),
        )
        .limit(1);

      if (!quote) return null;

      const [items, customerRows] = await Promise.all([
        ctx.db
          .select({
            id: QuoteItem.id,
            workspaceId: QuoteItem.workspaceId,
            quoteId: QuoteItem.quoteId,
            productId: QuoteItem.productId,
            productName: Product.name,
            sku: Product.sku,
            quantity: QuoteItem.quantity,
            unitPrice: QuoteItem.unitPrice,
            discount: QuoteItem.discount,
            lineTotal: QuoteItem.lineTotal,
          })
          .from(QuoteItem)
          .leftJoin(
            Product,
            and(
              eq(QuoteItem.productId, Product.id),
              eq(Product.workspaceId, ctx.workspace.workspaceId),
            ),
          )
          .where(
            and(
              eq(QuoteItem.quoteId, input.id),
              eq(QuoteItem.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
        quote.customerId
          ? ctx.db
              .select({
                id: Customer.id,
                name: Customer.name,
                legalName: Customer.legalName,
                identification: Customer.identification,
                phone: Customer.phone,
                email: Customer.email,
                address: Customer.address,
                customerType: Customer.customerType,
              })
              .from(Customer)
              .where(
                and(
                  eq(Customer.id, quote.customerId),
                  eq(Customer.workspaceId, ctx.workspace.workspaceId),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ]);

      return { ...quote, customer: customerRows[0] ?? null, items };
    }),

  create: wsPermissionProcedure("orders", "create")
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
        channel: z.enum(salesChannelEnum.enumValues),
        validUntil: z.string().datetime().optional(),
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
      await assertVendorCustomer(ctx, input.customerId);

      // Validate all products belong to workspace
      const productIds = input.items.map((i) => i.productId);
      if (productIds.length > 0) {
        const validProducts = await ctx.db
          .select({ id: Product.id })
          .from(Product)
          .where(
            and(
              inArray(Product.id, productIds),
              eq(Product.workspaceId, ctx.workspace.workspaceId),
            ),
          );
        if (validProducts.length !== productIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uno o más productos no pertenecen al espacio de trabajo",
          });
        }
      }

      const subtotal = input.items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );
      const totalDiscount = input.items.reduce(
        (sum, i) => sum + i.discount * i.quantity,
        0,
      );
      const total = subtotal - totalDiscount;

      const [quote] = await ctx.db
        .insert(Quote)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          // Trigger trg_quote_number assigns sequential number
          quoteNumber: "",
          customerId: input.customerId,
          channel: input.channel,
          subtotal,
          discount: totalDiscount,
          total,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      const effectiveQuoteNumber =
        quote?.quoteNumber && quote.quoteNumber.length > 0
          ? quote.quoteNumber
          : `QTE-${Date.now().toString(36).toUpperCase()}`;

      if (quote && input.items.length > 0) {
        await ctx.db.insert(QuoteItem).values(
          input.items.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            quoteId: quote.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: (item.unitPrice - item.discount) * item.quantity,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "quote.create",
        entity: "quote",
        entityId: quote?.id,
        newValue: {
          quoteNumber: effectiveQuoteNumber,
          channel: input.channel,
          total,
        },
      });

      return quote ? { ...quote, quoteNumber: effectiveQuoteNumber } : quote;
    }),

  updateStatus: wsPermissionProcedure("orders", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(quoteStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(Quote)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cotización no encontrada",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: `quote.status_${input.status}`,
        entity: "quote",
        entityId: input.id,
        newValue: { status: input.status },
      });

      return updated;
    }),

  convertToOrder: wsPermissionProcedure("orders", "create")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vendorId = vendorScopeId(ctx);
      const baseQuery = ctx.db
        .select()
        .from(Quote)
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
            vendorId ? eq(Quote.createdBy, vendorId) : undefined,
          ),
        )
        .limit(1);

      const lockedQuery =
        typeof (baseQuery as unknown as { for?: unknown }).for === "function"
          ? baseQuery.for("update")
          : baseQuery;

      const [quote] = await lockedQuery;

      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cotización no encontrada",
        });
      }

      if (quote.status === "converted") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta cotización ya fue convertida en pedido",
        });
      }

      if (
        quote.status === "rejected" ||
        quote.status === "expired" ||
        (quote.validUntil && new Date() > new Date(quote.validUntil))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede convertir una cotización vencida o rechazada",
        });
      }

      const items = await ctx.db
        .select()
        .from(QuoteItem)
        .where(
          and(
            eq(QuoteItem.quoteId, input.id),
            eq(QuoteItem.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      const [order] = await ctx.db
        .insert(SalesOrder)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          // Trigger trg_order_number assigns sequential number
          orderNumber: "",
          customerId: quote.customerId,
          channel: quote.channel,
          subtotal: quote.subtotal,
          discount: quote.discount ?? 0,
          total: quote.total,
          notes: `Convertido de cotización ${quote.quoteNumber}`,
          createdBy: ctx.user.id,
        })
        .returning();

      const effectiveOrderNumber =
        order?.orderNumber && order.orderNumber.length > 0
          ? order.orderNumber
          : `ORD-${Date.now().toString(36).toUpperCase()}`;

      if (order && items.length > 0) {
        await ctx.db.insert(OrderItem).values(
          items.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            lineTotal: item.lineTotal,
          })),
        );
      }

      // Mark quote as converted
      await ctx.db
        .update(Quote)
        .set({
          status: "converted",
          convertedOrderId: order?.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "quote.convert",
        entity: "quote",
        entityId: input.id,
        newValue: { orderNumber: effectiveOrderNumber, orderId: order?.id },
      });

      return order ? { ...order, orderNumber: effectiveOrderNumber } : order;
    }),
});
