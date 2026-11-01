/**
 * Cendaro — Applying a credit note: the single path, whether it is approved
 * from the invoices page or from the approvals inbox. The note row is locked,
 * so two approvals cannot apply it twice.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import {
  AccountReceivable,
  ChannelAllocation,
  CreditNote,
  CreditNoteItem,
  SalesOrder,
  StockLedger,
  StockMovement,
} from "@cendaro/db/schema";
import { MONEY_EPSILON, roundMoney2 } from "@cendaro/validators";

type Db = ReturnType<typeof getDb>;
type CreditNoteRow = typeof CreditNote.$inferSelect;

export async function lockPendingCreditNote(
  db: Db,
  workspaceId: string,
  noteId: string,
): Promise<CreditNoteRow> {
  const [note] = await db
    .select()
    .from(CreditNote)
    .where(
      and(eq(CreditNote.id, noteId), eq(CreditNote.workspaceId, workspaceId)),
    )
    .limit(1)
    .for("update");
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
  if (note.status !== "pending_approval") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Solo se puede resolver una nota de crédito pendiente",
    });
  }
  return note;
}

/**
 * Returns the goods to stock when the note says so, reduces the receivable of
 * the order by the note's total and marks the note as applied.
 */
export async function applyCreditNote(
  db: Db,
  actorId: string,
  workspaceId: string,
  noteId: string,
  externalRefundReference?: string,
): Promise<{ note: CreditNoteRow; arAdjustedAmount: number }> {
  const note = await lockPendingCreditNote(db, workspaceId, noteId);
  if (note.requestedBy === actorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Separación de funciones: no puedes aprobar una nota de crédito solicitada por ti",
    });
  }

  // A reversal may have returned the goods while this note was pending.
  const [order] = await db
    .select({ stockDeducted: SalesOrder.stockDeducted })
    .from(SalesOrder)
    .where(
      and(
        eq(SalesOrder.id, note.orderId),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");
  if (note.returnToStock && !order?.stockDeducted) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "La mercancía de este pedido ya volvió al inventario",
    });
  }

  const items = await db
    .select()
    .from(CreditNoteItem)
    .where(
      and(
        eq(CreditNoteItem.creditNoteId, note.id),
        eq(CreditNoteItem.workspaceId, workspaceId),
      ),
    );

  if (note.returnToStock && note.warehouseId) {
    for (const item of items) {
      await db
        .insert(StockLedger)
        .values({
          workspaceId,
          productId: item.productId,
          warehouseId: note.warehouseId,
          quantity: item.quantity,
        })
        .onConflictDoUpdate({
          target: [
            StockLedger.workspaceId,
            StockLedger.productId,
            StockLedger.warehouseId,
          ],
          set: {
            quantity: sql`${StockLedger.quantity} + ${item.quantity}`,
            updatedAt: new Date(),
          },
        });

      await db
        .insert(ChannelAllocation)
        .values({
          workspaceId,
          productId: item.productId,
          channel: "store",
          quantity: item.quantity,
        })
        .onConflictDoUpdate({
          target: [
            ChannelAllocation.workspaceId,
            ChannelAllocation.productId,
            ChannelAllocation.channel,
          ],
          set: {
            quantity: sql`${ChannelAllocation.quantity} + ${item.quantity}`,
            updatedAt: new Date(),
          },
        });

      await db.insert(StockMovement).values({
        workspaceId,
        productId: item.productId,
        warehouseId: note.warehouseId,
        movementType: "return",
        quantity: item.quantity,
        referenceType: "credit_note",
        referenceId: note.id,
        notes: `Devolución por Nota de Crédito ${note.creditNoteNumber}`,
        createdBy: actorId,
      });
    }
  }

  let arAdjustedAmount = 0;
  const [receivable] = await db
    .select()
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.orderId, note.orderId),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");

  if (
    receivable &&
    receivable.status !== "written_off" &&
    Number(receivable.balance) > 0
  ) {
    const currentBalance = Number(receivable.balance);
    // The receivable carries the order's amount, which does not include tax.
    const newBalance = Math.max(
      0,
      roundMoney2(currentBalance - Number(note.subtotalUsd)),
    );
    arAdjustedAmount = roundMoney2(currentBalance - newBalance);
    await db
      .update(AccountReceivable)
      .set({
        balance: newBalance,
        status: newBalance <= MONEY_EPSILON ? "paid" : "partial",
      })
      .where(
        and(
          eq(AccountReceivable.id, receivable.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
  }

  const [updated] = await db
    .update(CreditNote)
    .set({
      status: "applied",
      approvedBy: actorId,
      approvedAt: new Date(),
      externalRefundReference:
        externalRefundReference ?? note.externalRefundReference,
      updatedAt: new Date(),
    })
    .where(
      and(eq(CreditNote.id, note.id), eq(CreditNote.workspaceId, workspaceId)),
    )
    .returning();

  return { note: updated ?? note, arAdjustedAmount };
}

export async function cancelPendingCreditNote(
  db: Db,
  workspaceId: string,
  noteId: string,
): Promise<void> {
  await lockPendingCreditNote(db, workspaceId, noteId);
  await db
    .update(CreditNote)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(CreditNote.id, noteId), eq(CreditNote.workspaceId, workspaceId)),
    );
}
