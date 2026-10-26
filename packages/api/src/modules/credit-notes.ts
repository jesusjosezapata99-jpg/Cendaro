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
  AccountReceivable,
  Approval,
  ChannelAllocation,
  CreditNote,
  CreditNoteItem,
  creditNoteStatusEnum,
  OrderItem,
  paymentMethodEnum,
  Product,
  SalesOrder,
  StockLedger,
  StockMovement,
} from "@cendaro/db/schema";
import { multiplyMoney, roundMoney2 } from "@cendaro/validators";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

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
      const [note] = await ctx.db
        .select()
        .from(CreditNote)
        .where(
          and(eq(CreditNote.id, input.id), eq(CreditNote.workspaceId, wsId)),
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
  create: wsPermissionProcedure("orders", "create")
    .input(
      z.object({
        orderId: z.string().uuid(),
        internalInvoiceId: z.string().uuid().optional(),
        reason: z.string().min(3).max(1024),
        returnToStock: z.boolean().default(true),
        warehouseId: z.string().uuid().optional(),
        exchangeRateBcv: z.number().positive().default(1),
        taxUsd: z.number().min(0).default(0),
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
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido original no encontrado",
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

      const billedByProduct = new Map<
        string,
        { quantity: number; unitPrice: number }
      >();
      for (const oi of orderItems) {
        const prev = billedByProduct.get(oi.productId);
        billedByProduct.set(oi.productId, {
          quantity: (prev?.quantity ?? 0) + oi.quantity,
          unitPrice: Number(oi.unitPrice),
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

        const unitPriceUsd = roundMoney2(line.unitPriceUsd ?? billed.unitPrice);
        const lineSubtotal = multiplyMoney(unitPriceUsd, line.quantity);
        subtotalUsd = roundMoney2(subtotalUsd + lineSubtotal);

        preparedItems.push({
          productId: line.productId,
          quantity: line.quantity,
          unitPriceUsd,
          subtotalUsd: lineSubtotal,
        });
      }

      const taxUsd = roundMoney2(input.taxUsd);
      const totalUsd = roundMoney2(subtotalUsd + taxUsd);
      const totalVes = multiplyMoney(totalUsd, input.exchangeRateBcv);
      const creditNoteNumber = `NC-${Date.now().toString(36).toUpperCase()}`;

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
          exchangeRateBcv: input.exchangeRateBcv,
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

      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo propietarios, administradores o supervisores pueden aprobar notas de crédito",
        });
      }

      const [note] = await ctx.db
        .select()
        .from(CreditNote)
        .where(
          and(eq(CreditNote.id, input.id), eq(CreditNote.workspaceId, wsId)),
        )
        .limit(1);

      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nota de crédito no encontrada",
        });
      }

      if (note.status === "applied" || note.status === "approved") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta nota de crédito ya fue aprobada y aplicada",
        });
      }

      if (note.status === "cancelled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No se puede aprobar una nota de crédito anulada",
        });
      }

      const items = await ctx.db
        .select()
        .from(CreditNoteItem)
        .where(
          and(
            eq(CreditNoteItem.creditNoteId, note.id),
            eq(CreditNoteItem.workspaceId, wsId),
          ),
        );

      // 1. Return items to stock if configured
      if (note.returnToStock && note.warehouseId) {
        for (const item of items) {
          const [existingStock] = await ctx.db
            .select()
            .from(StockLedger)
            .where(
              and(
                eq(StockLedger.workspaceId, wsId),
                eq(StockLedger.productId, item.productId),
                eq(StockLedger.warehouseId, note.warehouseId),
              ),
            )
            .limit(1);

          if (existingStock) {
            await ctx.db
              .update(StockLedger)
              .set({
                quantity: sql`${StockLedger.quantity} + ${item.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(StockLedger.id, existingStock.id));
          } else {
            await ctx.db.insert(StockLedger).values({
              workspaceId: wsId,
              productId: item.productId,
              warehouseId: note.warehouseId,
              quantity: item.quantity,
            });
          }

          await ctx.db
            .insert(ChannelAllocation)
            .values({
              workspaceId: wsId,
              productId: item.productId,
              channel: "store",
              quantity: item.quantity,
            })
            .onConflictDoUpdate({
              target: [ChannelAllocation.productId, ChannelAllocation.channel],
              set: {
                quantity: sql`${ChannelAllocation.quantity} + ${item.quantity}`,
                updatedAt: new Date(),
              },
            });

          await ctx.db.insert(StockMovement).values({
            workspaceId: wsId,
            productId: item.productId,
            warehouseId: note.warehouseId,
            movementType: "return",
            quantity: item.quantity,
            referenceType: "credit_note",
            referenceId: note.id,
            notes: `Devolución por Nota de Crédito ${note.creditNoteNumber}`,
            createdBy: ctx.user.id,
          });
        }
      }

      // 2. Reduce open AccountReceivable balance on the original order if present
      let arAdjustedAmount = 0;
      const [ar] = await ctx.db
        .select()
        .from(AccountReceivable)
        .where(
          and(
            eq(AccountReceivable.orderId, note.orderId),
            eq(AccountReceivable.workspaceId, wsId),
          ),
        )
        .limit(1);

      if (ar && Number(ar.balance) > 0) {
        const currentBalance = Number(ar.balance);
        const creditAmount = Number(note.totalUsd);
        const newBalance = Math.max(
          0,
          roundMoney2(currentBalance - creditAmount),
        );
        arAdjustedAmount = roundMoney2(currentBalance - newBalance);

        await ctx.db
          .update(AccountReceivable)
          .set({
            balance: newBalance,
            status: newBalance <= 0.009 ? "paid" : "partial",
          })
          .where(
            and(
              eq(AccountReceivable.id, ar.id),
              eq(AccountReceivable.workspaceId, wsId),
            ),
          );
      }

      // 3. Mark CreditNote as applied
      const [updated] = await ctx.db
        .update(CreditNote)
        .set({
          status: "applied",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          externalRefundReference:
            input.externalRefundReference ?? note.externalRefundReference,
          updatedAt: new Date(),
        })
        .where(
          and(eq(CreditNote.id, note.id), eq(CreditNote.workspaceId, wsId)),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "credit_note.approve",
        entity: "credit_note",
        entityId: note.id,
        oldValue: { status: note.status },
        newValue: {
          status: "applied",
          arAdjustedAmount,
          returnToStock: note.returnToStock,
          externalRefundReference:
            input.externalRefundReference ?? note.externalRefundReference,
        },
      });

      return updated;
    }),
});
