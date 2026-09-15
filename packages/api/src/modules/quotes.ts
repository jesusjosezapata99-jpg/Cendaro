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
  OrderItem,
  Product,
  Quote,
  QuoteItem,
  quoteStatusEnum,
  salesChannelEnum,
  SalesOrder,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const quotesRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        status: z.enum(quoteStatusEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Quote.workspaceId, ctx.workspace.workspaceId)];
      if (input.status) {
        conditions.push(eq(Quote.status, input.status));
      }

      return ctx.db
        .select({
          id: Quote.id,
          quoteNumber: Quote.quoteNumber,
          customerId: Quote.customerId,
          status: Quote.status,
          channel: Quote.channel,
          total: Quote.total,
          validUntil: Quote.validUntil,
          createdAt: Quote.createdAt,
        })
        .from(Quote)
        .where(and(...conditions))
        .orderBy(desc(Quote.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  byId: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [quote] = await ctx.db
        .select()
        .from(Quote)
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!quote) return null;

      const items = await ctx.db
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
        );

      return { ...quote, items };
    }),

  create: workspaceProcedure
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

      const quoteNumber = `QTE-${Date.now().toString(36).toUpperCase()}`;

      const [quote] = await ctx.db
        .insert(Quote)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          quoteNumber,
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
        newValue: { quoteNumber, channel: input.channel, total },
      });

      return quote;
    }),

  updateStatus: workspaceProcedure
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

  convertToOrder: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [quote] = await ctx.db
        .select()
        .from(Quote)
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cotización no encontrada",
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

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const [order] = await ctx.db
        .insert(SalesOrder)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          orderNumber,
          customerId: quote.customerId,
          channel: quote.channel,
          subtotal: quote.subtotal,
          discount: quote.discount ?? 0,
          total: quote.total,
          notes: `Convertido de cotización ${quote.quoteNumber}`,
          createdBy: ctx.user.id,
        })
        .returning();

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
        newValue: { orderNumber, orderId: order?.id },
      });

      return order;
    }),
});
