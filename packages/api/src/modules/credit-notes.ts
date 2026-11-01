/**
 * Cendaro — Credit Notes Router (PRD v2.0 §3.1, F10.2)
 *
 * Manages credit notes (notas de crédito y devoluciones) linked to sales orders
 * and internal invoices, with executive approval, inventory return-to-stock,
 * and Accounts Receivable (CxC) balance adjustment.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  Approval,
  CreditNote,
  CreditNoteItem,
  creditNoteStatusEnum,
  FiscalDocument,
  InternalInvoice,
  OrderItem,
  paymentMethodEnum,
  Product,
  SalesOrder,
  Warehouse,
} from "@cendaro/db/schema";
import { MONEY_EPSILON, multiplyMoney, roundMoney2 } from "@cendaro/validators";

import { applyCreditNote } from "../services/credit-note-application";
import { getOfficialBcvRate } from "../services/official-rate";
import { assertInWorkspace } from "../services/workspace-guard";
import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import { createdByVendor, vendorScopeId } from "./vendor-scope";

export const creditNotesRouter = createTRPCRouter({
  /** List credit notes for the current workspace */
  list: wsReadPermissionProcedure("orders", "read")
    .input(
      z
        .object({
          orderId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          status: z.enum(creditNoteStatusEnum.enumValues).optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const conditions = [eq(CreditNote.workspaceId, wsId)];
      const vendorId = vendorScopeId(ctx);
      if (vendorId)
        conditions.push(createdByVendor(CreditNote.orderId, vendorId));
      if (input?.orderId)
        conditions.push(eq(CreditNote.orderId, input.orderId));
      if (input?.customerId) {
        conditions.push(eq(CreditNote.customerId, input.customerId));
      }
      if (input?.status) conditions.push(eq(CreditNote.status, input.status));

      return ctx.db
        .select()
        .from(CreditNote)
        .where(and(...conditions))
        .orderBy(desc(CreditNote.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);
    }),

  /** Get credit note details and line items by ID */
  byId: wsReadPermissionProcedure("orders", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const vendorId = vendorScopeId(ctx);
      const [note] = await ctx.db
        .select()
        .from(CreditNote)
        .where(
          and(
            eq(CreditNote.id, input.id),
            eq(CreditNote.workspaceId, wsId),
            vendorId
              ? createdByVendor(CreditNote.orderId, vendorId)
              : undefined,
          ),
        )
        .limit(1);

      if (!note) return null;

      const items = await ctx.db
        .select({
          id: CreditNoteItem.id,
          creditNoteId: CreditNoteItem.creditNoteId,
          productId: CreditNoteItem.productId,
          productName: Product.name,
          productCode: Product.sku,
          quantity: CreditNoteItem.quantity,
          unitPriceUsd: CreditNoteItem.unitPriceUsd,
          subtotalUsd: CreditNoteItem.subtotalUsd,
        })
        .from(CreditNoteItem)
        .leftJoin(Product, eq(Product.id, CreditNoteItem.productId))
        .where(
          and(
            eq(CreditNoteItem.creditNoteId, note.id),
            eq(CreditNoteItem.workspaceId, wsId),
          ),
        );

      return { ...note, items };
    }),

  /**
   * Create a new credit note in `pending_approval` status.
   * Validates that returned quantities do not exceed billed quantities on the order.
   */
  create: wsPermissionProcedure("orders", "update")
    .input(
      z.object({
        orderId: z.string().uuid(),
        internalInvoiceId: z.string().uuid().optional(),
        reason: z.string().min(3).max(1024),
        returnToStock: z.boolean().default(true),
        warehouseId: z.string().uuid().optional(),
        refundMethod: z.enum(paymentMethodEnum.enumValues).optional(),
        externalRefundReference: z.string().max(128).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().positive(),
              unitPriceUsd: z.number().min(0).optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      if (input.returnToStock && !input.warehouseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Debe especificar el almacén de destino cuando la nota de crédito devuelve mercancía al stock",
        });
      }

      const [order] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.id, input.orderId),
            eq(SalesOrder.workspaceId, wsId),
          ),
        )
        .limit(1)
        .for("update");

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido original no encontrado",
        });
      }

      await assertInWorkspace(
        ctx.db,
        Warehouse,
        input.warehouseId,
        wsId,
        "Almacén",
      );
      await assertInWorkspace(
        ctx.db,
        InternalInvoice,
        input.internalInvoiceId,
        wsId,
        "Factura interna",
      );

      if (input.returnToStock && !order.stockDeducted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "La mercancía de este pedido no ha salido del inventario: no hay nada que devolver a stock",
        });
      }

      if (order.status === "cancelled" || order.status === "draft") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Solo se pueden emitir notas de crédito sobre pedidos confirmados, despachados o facturados",
        });
      }

      const orderItems = await ctx.db
        .select()
        .from(OrderItem)
        .where(
          and(eq(OrderItem.orderId, order.id), eq(OrderItem.workspaceId, wsId)),
        );

      // What the customer was charged per unit, net of discounts, across every
      // line of the product.
      const billedByProduct = new Map<
        string,
        { quantity: number; netTotal: number }
      >();
      for (const oi of orderItems) {
        const prev = billedByProduct.get(oi.productId);
        billedByProduct.set(oi.productId, {
          quantity: (prev?.quantity ?? 0) + oi.quantity,
          netTotal:
            (prev?.netTotal ?? 0) +
            (Number(oi.unitPrice) - Number(oi.discount ?? 0)) * oi.quantity,
        });
      }

      // Check already credited quantities across non-cancelled credit notes on this order
      const existingNotes = await ctx.db
        .select({ id: CreditNote.id })
        .from(CreditNote)
        .where(
          and(
            eq(CreditNote.orderId, order.id),
            eq(CreditNote.workspaceId, wsId),
            ne(CreditNote.status, "cancelled"),
          ),
        );

      const creditedByProduct = new Map<string, number>();
      if (existingNotes.length > 0) {
        const noteIds = existingNotes.map((n) => n.id);
        const prevItems = await ctx.db
          .select()
          .from(CreditNoteItem)
          .where(
            and(
              inArray(CreditNoteItem.creditNoteId, noteIds),
              eq(CreditNoteItem.workspaceId, wsId),
            ),
          );
        for (const pi of prevItems) {
          creditedByProduct.set(
            pi.productId,
            (creditedByProduct.get(pi.productId) ?? 0) + pi.quantity,
          );
        }
      }

      const preparedItems: {
        productId: string;
        quantity: number;
        unitPriceUsd: number;
        subtotalUsd: number;
      }[] = [];

      let subtotalUsd = 0;

      for (const line of input.items) {
        const billed = billedByProduct.get(line.productId);
        if (!billed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El producto ${line.productId} no pertenece al pedido original`,
          });
        }
        const alreadyCredited = creditedByProduct.get(line.productId) ?? 0;
        const maxReturnable = billed.quantity - alreadyCredited;
        if (line.quantity > maxReturnable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La cantidad a devolver (${line.quantity}) excede la cantidad disponible para devolución (${maxReturnable})`,
          });
        }

        const billedUnitPrice = roundMoney2(billed.netTotal / billed.quantity);
        if (
          line.unitPriceUsd !== undefined &&
          line.unitPriceUsd > billedUnitPrice + MONEY_EPSILON
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "El precio unitario de la nota de crédito no puede superar el precio cobrado",
          });
        }

        const unitPriceUsd = roundMoney2(line.unitPriceUsd ?? billedUnitPrice);
        const lineSubtotal = multiplyMoney(unitPriceUsd, line.quantity);
        subtotalUsd = roundMoney2(subtotalUsd + lineSubtotal);

        preparedItems.push({
          productId: line.productId,
          quantity: line.quantity,
          unitPriceUsd,
          subtotalUsd: lineSubtotal,
        });
      }

      // Tax follows the fiscal document of the order, in proportion to what is credited.
      const [fiscalDocument] = await ctx.db
        .select({
          iva16Usd: FiscalDocument.iva16Usd,
          iva8Usd: FiscalDocument.iva8Usd,
          exemptAmountUsd: FiscalDocument.exemptAmountUsd,
          taxableBase16Usd: FiscalDocument.taxableBase16Usd,
          taxableBase8Usd: FiscalDocument.taxableBase8Usd,
        })
        .from(FiscalDocument)
        .where(
          and(
            eq(FiscalDocument.orderId, order.id),
            eq(FiscalDocument.workspaceId, wsId),
            eq(FiscalDocument.documentType, "factura"),
          ),
        )
        .limit(1);
      const documentBase = fiscalDocument
        ? fiscalDocument.exemptAmountUsd +
          fiscalDocument.taxableBase16Usd +
          fiscalDocument.taxableBase8Usd
        : 0;
      const taxUsd =
        fiscalDocument && documentBase > 0
          ? roundMoney2(
              (subtotalUsd *
                (fiscalDocument.iva16Usd + fiscalDocument.iva8Usd)) /
                documentBase,
            )
          : 0;
      const totalUsd = roundMoney2(subtotalUsd + taxUsd);
      const exchangeRateBcv = await getOfficialBcvRate(ctx.db, wsId);
      const totalVes = multiplyMoney(totalUsd, exchangeRateBcv);
      const numberResult = await ctx.db.execute<{ number: string }>(
        sql`SELECT public.next_document_number(${wsId}::uuid, 'credit_note') AS number`,
      );
      const creditNoteNumber = numberResult.rows[0]?.number;
      if (!creditNoteNumber) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo numerar la nota de crédito",
        });
      }

      const [created] = await ctx.db
        .insert(CreditNote)
        .values({
          workspaceId: wsId,
          creditNoteNumber,
          orderId: order.id,
          internalInvoiceId: input.internalInvoiceId,
          customerId: order.customerId,
          status: "pending_approval",
          reason: input.reason,
          returnToStock: input.returnToStock,
          warehouseId: input.warehouseId,
          subtotalUsd,
          taxUsd,
          totalUsd,
          exchangeRateBcv,
          totalVes,
          refundMethod: input.refundMethod,
          externalRefundReference: input.externalRefundReference,
          requestedBy: ctx.user.id,
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear la nota de crédito",
        });
      }

      await ctx.db.insert(CreditNoteItem).values(
        preparedItems.map((pi) => ({
          workspaceId: wsId,
          creditNoteId: created.id,
          productId: pi.productId,
          quantity: pi.quantity,
          unitPriceUsd: pi.unitPriceUsd,
          subtotalUsd: pi.subtotalUsd,
        })),
      );

      // Register executive approval request
      await ctx.db.insert(Approval).values({
        workspaceId: wsId,
        approvalType: "edit_post_issue_document",
        status: "pending",
        entityType: "credit_note",
        entityId: created.id,
        requestedBy: ctx.user.id,
        reason: `Nota de Crédito ${creditNoteNumber}: ${input.reason}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalUsd,
          returnToStock: input.returnToStock,
        },
      });

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "credit_note.create",
        entity: "credit_note",
        entityId: created.id,
        newValue: {
          creditNoteNumber,
          orderId: order.id,
          totalUsd,
          returnToStock: input.returnToStock,
          itemsCount: preparedItems.length,
        },
      });

      return created;
    }),

  /**
   * Approve and apply a credit note:
   * - Restores stock in `StockLedger` and `ChannelAllocation` + writes `StockMovement` (`return`) when `returnToStock` is true.
   * - Reduces `AccountReceivable.balance` on the linked order when an open AR balance exists.
   */
  approve: wsPermissionProcedure("orders", "approve")
    .input(
      z.object({
        id: z.string().uuid(),
        externalRefundReference: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      const { note: updated, arAdjustedAmount } = await applyCreditNote(
        ctx.db,
        ctx.user.id,
        wsId,
        input.id,
        input.externalRefundReference,
      );

      // Keep the approvals inbox in step with a note approved from here.
      await ctx.db
        .update(Approval)
        .set({
          status: "approved",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(Approval.workspaceId, wsId),
            eq(Approval.entityType, "credit_note"),
            eq(Approval.entityId, updated.id),
            eq(Approval.status, "pending"),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "credit_note.approve",
        entity: "credit_note",
        entityId: updated.id,
        oldValue: { status: "pending_approval" },
        newValue: {
          status: "applied",
          arAdjustedAmount,
          returnToStock: updated.returnToStock,
          externalRefundReference: updated.externalRefundReference,
        },
      });

      return updated;
    }),
});
