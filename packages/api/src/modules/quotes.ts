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
  Product,
  Quote,
  QuoteItem,
  quoteStatusEnum,
  salesChannelEnum,
} from "@cendaro/db/schema";
import { lineTotal, orderTotals, PAYMENT_TERMS } from "@cendaro/validators";

import { createCommercialOrder } from "../services/order-lifecycle";
import { assertInWorkspace } from "../services/workspace-guard";
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
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().positive(),
              unitPrice: z.number().positive(),
              discount: z.number().nonnegative().default(0),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertVendorCustomer(ctx, input.customerId);

      // Reject inverted discounts (discount > unitPrice)
      if (input.items.some((i) => i.discount > i.unitPrice)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El descuento de un artículo no puede superar su precio",
        });
      }

      await assertInWorkspace(
        ctx.db,
        Customer,
        input.customerId,
        ctx.workspace.workspaceId,
        "Cliente",
      );
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

      const {
        subtotal,
        discount: totalDiscount,
        total,
      } = orderTotals(input.items);

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

      if (quote && input.items.length > 0) {
        await ctx.db.insert(QuoteItem).values(
          input.items.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            quoteId: quote.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: lineTotal(item),
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "quote.create",
        entity: "quote",
        entityId: quote?.id,
        newValue: {
          quoteNumber: quote?.quoteNumber,
          channel: input.channel,
          total,
        },
      });

      return quote;
    }),

  updateStatus: wsPermissionProcedure("orders", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(quoteStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only convertToOrder converts, and a converted quote stays that way:
      // reopening it would allow a second order from the same quote.
      if (input.status === "converted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Una cotización se convierte creando el pedido",
        });
      }
      const [current] = await ctx.db
        .select({ status: Quote.status })
        .from(Quote)
        .where(
          and(
            eq(Quote.id, input.id),
            eq(Quote.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1)
        .for("update");
      if (current?.status === "converted") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta cotización ya fue convertida en pedido",
        });
      }

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
    .input(
      z.object({
        id: z.string().uuid(),
        paymentTerms: z.enum(PAYMENT_TERMS).default("cash"),
      }),
    )
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

      const [quote] = await baseQuery.for("update");

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

      await assertVendorCustomer(ctx, quote.customerId);

      const items = await ctx.db
        .select()
        .from(QuoteItem)
        .where(
          and(
            eq(QuoteItem.quoteId, input.id),
            eq(QuoteItem.workspaceId, ctx.workspace.workspaceId),
          ),
        );
      if (items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La cotización no tiene artículos",
        });
      }

      // Prices are checked again: the catalog may have changed since the quote.
      const order = await createCommercialOrder(ctx, {
        customerId: quote.customerId,
        channel: quote.channel,
        notes: `Convertido de cotización ${quote.quoteNumber}`,
        paymentTerms: input.paymentTerms,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount ?? 0),
        })),
      });

      // Mark quote as converted
      await ctx.db
        .update(Quote)
        .set({
          status: "converted",
          convertedOrderId: order.id,
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
        newValue: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          status: order.status,
        },
      });

      return order;
    }),
});
