/**
 * Cendaro — SENIAT Fiscal Engine & Multi-Branch Router (PRD v2.0, F11.1 & F11.2)
 *
 * Implements:
 * - Multi-rate IVA calculation (16% General, 8% Reducida, 0% Exento)
 * - IGTF 3% calculation on foreign-currency payments (Efectivo USD / Zelle)
 * - IVA Retentions (75% / 100%) and ISLR Retentions with voucher tracking & AR balance adjustment
 * - SENIAT Libro de Ventas generator (dual USD / VES ledger)
 * - Multi-Legal Entity (`LegalEntity`) & Multi-Branch (`Branch`) management
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AccountReceivable,
  Branch,
  FiscalDocument,
  fiscalDocumentTypeEnum,
  LegalEntity,
  taxClassificationEnum,
} from "@cendaro/db/schema";
import {
  addMoney,
  calculatePercentage,
  convertUsdToVes,
  roundMoney2,
} from "@cendaro/validators";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export interface SeniatLineInput {
  subtotalUsd: number;
  taxClassification: "standard_16" | "reduced_8" | "exempt_0";
}

export interface SeniatBreakdown {
  exemptAmountUsd: number;
  taxableBase16Usd: number;
  iva16Usd: number;
  taxableBase8Usd: number;
  iva8Usd: number;
  igtfBaseUsd: number;
  igtf3Usd: number;
  totalUsd: number;
  totalVes: number;
}

/**
 * Pure deterministic calculator for Venezuelan SENIAT tax breakdown:
 * - Alícuota General (16%)
 * - Alícuota Reducida (8%)
 * - Exento (0%)
 * - IGTF (3% sobre pagos en divisas / efectivo USD / Zelle)
 */
export function computeSeniatBreakdown(params: {
  lines: SeniatLineInput[];
  igtfBaseUsd?: number;
  exchangeRateBcv: number;
}): SeniatBreakdown {
  let exemptAmountUsd = 0;
  let taxableBase16Usd = 0;
  let taxableBase8Usd = 0;

  for (const line of params.lines) {
    const amount = roundMoney2(Math.max(0, line.subtotalUsd));
    if (line.taxClassification === "exempt_0") {
      exemptAmountUsd = addMoney(exemptAmountUsd, amount);
    } else if (line.taxClassification === "reduced_8") {
      taxableBase8Usd = addMoney(taxableBase8Usd, amount);
    } else {
      taxableBase16Usd = addMoney(taxableBase16Usd, amount);
    }
  }

  const iva16Usd = calculatePercentage(taxableBase16Usd, 16);
  const iva8Usd = calculatePercentage(taxableBase8Usd, 8);
  const igtfBaseUsd = roundMoney2(Math.max(0, params.igtfBaseUsd ?? 0));
  const igtf3Usd = calculatePercentage(igtfBaseUsd, 3);

  const totalUsd = addMoney(
    exemptAmountUsd,
    taxableBase16Usd,
    iva16Usd,
    taxableBase8Usd,
    iva8Usd,
    igtf3Usd,
  );
  const totalVes = convertUsdToVes(totalUsd, params.exchangeRateBcv);

  return {
    exemptAmountUsd,
    taxableBase16Usd,
    iva16Usd,
    taxableBase8Usd,
    iva8Usd,
    igtfBaseUsd,
    igtf3Usd,
    totalUsd,
    totalVes,
  };
}

/**
 * Computes SENIAT IVA retention (75% or 100% of total IVA) and ISLR retention
 * (percentage of taxable base).
 */
export function computeFiscalRetentions(params: {
  iva16Usd: number;
  iva8Usd: number;
  taxableBaseUsd: number;
  ivaRetentionPct: 0 | 75 | 100;
  islrRetentionPct: number;
  exchangeRateBcv: number;
}) {
  const totalIvaUsd = addMoney(params.iva16Usd, params.iva8Usd);
  const ivaRetentionUsd = calculatePercentage(
    totalIvaUsd,
    params.ivaRetentionPct,
  );
  const ivaRetentionVes = convertUsdToVes(
    ivaRetentionUsd,
    params.exchangeRateBcv,
  );
  const islrRetentionUsd = calculatePercentage(
    params.taxableBaseUsd,
    params.islrRetentionPct,
  );

  return {
    ivaRetentionUsd,
    ivaRetentionVes,
    islrRetentionUsd,
    totalRetainedUsd: addMoney(ivaRetentionUsd, islrRetentionUsd),
  };
}

export const fiscalRouter = createTRPCRouter({
  /** List SENIAT fiscal documents for the current workspace */
  listDocuments: wsReadPermissionProcedure("orders", "read")
    .input(
      z
        .object({
          documentType: z.enum(fiscalDocumentTypeEnum.enumValues).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const conditions = [eq(FiscalDocument.workspaceId, wsId)];
      if (input?.documentType) {
        conditions.push(eq(FiscalDocument.documentType, input.documentType));
      }

      return ctx.db
        .select()
        .from(FiscalDocument)
        .where(and(...conditions))
        .orderBy(desc(FiscalDocument.issuedAt))
        .limit(input?.limit ?? 50);
    }),

  /** Emit a SENIAT Fiscal Document (Factura, Nota de Crédito, Nota de Débito) */
  emitDocument: wsPermissionProcedure("orders", "create")
    .input(
      z.object({
        legalEntityId: z.string().uuid().optional(),
        branchId: z.string().uuid().optional(),
        orderId: z.string().uuid().optional(),
        internalInvoiceId: z.string().uuid().optional(),
        creditNoteId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        documentType: z
          .enum(fiscalDocumentTypeEnum.enumValues)
          .default("factura"),
        fiscalInvoiceNumber: z.string().min(1).max(64).optional(),
        controlNumber: z.string().min(1).max(64).optional(),
        affectedInvoiceNumber: z.string().max(64).optional(),
        buyerRif: z.string().min(3).max(32),
        buyerLegalName: z.string().min(2).max(256),
        buyerAddress: z.string().max(512).optional(),
        exchangeRateBcv: z.number().positive(),
        igtfBaseUsd: z.number().min(0).default(0),
        lines: z
          .array(
            z.object({
              subtotalUsd: z.number().min(0),
              taxClassification: z
                .enum(taxClassificationEnum.enumValues)
                .default("standard_16"),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      if (
        (input.documentType === "nota_credito" ||
          input.documentType === "nota_debito") &&
        !input.affectedInvoiceNumber
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Las Notas de Crédito y Notas de Débito fiscales requieren el número de factura afectada exigido por SENIAT",
        });
      }

      const breakdown = computeSeniatBreakdown({
        lines: input.lines,
        igtfBaseUsd: input.igtfBaseUsd,
        exchangeRateBcv: input.exchangeRateBcv,
      });

      const suffix = Date.now().toString().slice(-8);
      const fiscalInvoiceNumber = input.fiscalInvoiceNumber ?? `A-${suffix}`;
      const controlNumber = input.controlNumber ?? `00-${suffix}`;

      const [created] = await ctx.db
        .insert(FiscalDocument)
        .values({
          workspaceId: wsId,
          legalEntityId: input.legalEntityId,
          branchId: input.branchId,
          orderId: input.orderId,
          internalInvoiceId: input.internalInvoiceId,
          creditNoteId: input.creditNoteId,
          customerId: input.customerId,
          documentType: input.documentType,
          fiscalInvoiceNumber,
          controlNumber,
          affectedInvoiceNumber: input.affectedInvoiceNumber,
          buyerRif: input.buyerRif.trim().toUpperCase(),
          buyerLegalName: input.buyerLegalName.trim(),
          buyerAddress: input.buyerAddress?.trim(),
          exchangeRateBcv: input.exchangeRateBcv,
          exemptAmountUsd: breakdown.exemptAmountUsd,
          taxableBase16Usd: breakdown.taxableBase16Usd,
          iva16Usd: breakdown.iva16Usd,
          taxableBase8Usd: breakdown.taxableBase8Usd,
          iva8Usd: breakdown.iva8Usd,
          igtfBaseUsd: breakdown.igtfBaseUsd,
          igtf3Usd: breakdown.igtf3Usd,
          totalUsd: breakdown.totalUsd,
          totalVes: breakdown.totalVes,
          issuedBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "fiscal.emit_document",
        entity: "fiscal_document",
        entityId: created?.id,
        newValue: {
          documentType: input.documentType,
          fiscalInvoiceNumber,
          controlNumber,
          buyerRif: input.buyerRif,
          totalUsd: breakdown.totalUsd,
          totalVes: breakdown.totalVes,
        },
      });

      return created;
    }),

  /** Record SENIAT IVA (75%/100%) or ISLR retention voucher against a FiscalDocument */
  recordRetention: wsPermissionProcedure("payments", "create")
    .input(
      z.object({
        fiscalDocumentId: z.string().uuid(),
        ivaRetentionPct: z.union([z.literal(0), z.literal(75), z.literal(100)]),
        ivaRetentionVoucher: z.string().max(64).optional(),
        islrRetentionPct: z.number().min(0).max(34).default(0),
        islrRetentionVoucher: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      const [doc] = await ctx.db
        .select()
        .from(FiscalDocument)
        .where(
          and(
            eq(FiscalDocument.id, input.fiscalDocumentId),
            eq(FiscalDocument.workspaceId, wsId),
          ),
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento fiscal no encontrado",
        });
      }

      const taxableBaseUsd = addMoney(
        doc.taxableBase16Usd,
        doc.taxableBase8Usd,
      );
      const retentions = computeFiscalRetentions({
        iva16Usd: doc.iva16Usd,
        iva8Usd: doc.iva8Usd,
        taxableBaseUsd,
        ivaRetentionPct: input.ivaRetentionPct,
        islrRetentionPct: input.islrRetentionPct,
        exchangeRateBcv: doc.exchangeRateBcv,
      });

      const [updated] = await ctx.db
        .update(FiscalDocument)
        .set({
          ivaRetentionPct: input.ivaRetentionPct,
          ivaRetentionVoucher: input.ivaRetentionVoucher,
          ivaRetentionUsd: retentions.ivaRetentionUsd,
          ivaRetentionVes: retentions.ivaRetentionVes,
          islrRetentionPct: input.islrRetentionPct,
          islrRetentionVoucher: input.islrRetentionVoucher,
          islrRetentionUsd: retentions.islrRetentionUsd,
        })
        .where(
          and(
            eq(FiscalDocument.id, doc.id),
            eq(FiscalDocument.workspaceId, wsId),
          ),
        )
        .returning();

      // Adjust open AccountReceivable if the fiscal document is linked to an order
      if (doc.orderId && retentions.totalRetainedUsd > 0) {
        const [ar] = await ctx.db
          .select()
          .from(AccountReceivable)
          .where(
            and(
              eq(AccountReceivable.orderId, doc.orderId),
              eq(AccountReceivable.workspaceId, wsId),
            ),
          )
          .limit(1);

        if (ar && Number(ar.balance) > 0) {
          const newBalance = Math.max(
            0,
            roundMoney2(Number(ar.balance) - retentions.totalRetainedUsd),
          );
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
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "fiscal.record_retention",
        entity: "fiscal_document",
        entityId: doc.id,
        newValue: {
          ivaRetentionPct: input.ivaRetentionPct,
          ivaRetentionVoucher: input.ivaRetentionVoucher,
          ivaRetentionUsd: retentions.ivaRetentionUsd,
          islrRetentionPct: input.islrRetentionPct,
          islrRetentionUsd: retentions.islrRetentionUsd,
        },
      });

      return updated;
    }),

  /** Generate SENIAT Libro de Ventas report for a period */
  salesBookReport: wsReadPermissionProcedure("orders", "read")
    .input(
      z
        .object({
          fromDate: z.string().datetime().optional(),
          toDate: z.string().datetime().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const conditions = [eq(FiscalDocument.workspaceId, wsId)];
      if (input?.fromDate) {
        conditions.push(gte(FiscalDocument.issuedAt, new Date(input.fromDate)));
      }
      if (input?.toDate) {
        conditions.push(lte(FiscalDocument.issuedAt, new Date(input.toDate)));
      }

      const rows = await ctx.db
        .select()
        .from(FiscalDocument)
        .where(and(...conditions))
        .orderBy(asc(FiscalDocument.issuedAt));

      let totalExemptUsd = 0;
      let totalBase16Usd = 0;
      let totalIva16Usd = 0;
      let totalBase8Usd = 0;
      let totalIva8Usd = 0;
      let totalIgtf3Usd = 0;
      let totalRetainedIvaUsd = 0;
      let totalUsd = 0;
      let totalVes = 0;

      for (const r of rows) {
        const sign = r.documentType === "nota_credito" ? -1 : 1;
        totalExemptUsd = addMoney(totalExemptUsd, sign * r.exemptAmountUsd);
        totalBase16Usd = addMoney(totalBase16Usd, sign * r.taxableBase16Usd);
        totalIva16Usd = addMoney(totalIva16Usd, sign * r.iva16Usd);
        totalBase8Usd = addMoney(totalBase8Usd, sign * r.taxableBase8Usd);
        totalIva8Usd = addMoney(totalIva8Usd, sign * r.iva8Usd);
        totalIgtf3Usd = addMoney(totalIgtf3Usd, sign * r.igtf3Usd);
        totalRetainedIvaUsd = addMoney(
          totalRetainedIvaUsd,
          sign * r.ivaRetentionUsd,
        );
        totalUsd = addMoney(totalUsd, sign * r.totalUsd);
        totalVes = addMoney(totalVes, sign * r.totalVes);
      }

      return {
        rows,
        summary: {
          documentsCount: rows.length,
          totalExemptUsd,
          totalBase16Usd,
          totalIva16Usd,
          totalBase8Usd,
          totalIva8Usd,
          totalIgtf3Usd,
          totalRetainedIvaUsd,
          totalUsd,
          totalVes,
        },
      };
    }),

  // ─── Multi-Legal Entity & Multi-Branch (F11.2) ──────────────────────

  listLegalEntities: wsReadPermissionProcedure("settings", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select()
        .from(LegalEntity)
        .where(eq(LegalEntity.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(LegalEntity.isDefault), asc(LegalEntity.legalName));
    },
  ),

  saveLegalEntity: wsPermissionProcedure("settings", "update")
    .input(
      z.object({
        id: z.string().uuid().optional(),
        rif: z.string().min(5).max(32),
        legalName: z.string().min(2).max(256),
        tradeName: z.string().max(256).optional(),
        fiscalAddress: z.string().min(5).max(1024),
        taxpayerType: z.string().max(64).default("ordinario"),
        isSpecialTaxpayer: z.boolean().default(false),
        retentionRatePct: z.union([z.literal(75), z.literal(100)]).default(75),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      if (input.id) {
        const [updated] = await ctx.db
          .update(LegalEntity)
          .set({
            rif: input.rif.trim().toUpperCase(),
            legalName: input.legalName.trim(),
            tradeName: input.tradeName?.trim(),
            fiscalAddress: input.fiscalAddress.trim(),
            taxpayerType: input.taxpayerType,
            isSpecialTaxpayer: input.isSpecialTaxpayer,
            retentionRatePct: input.retentionRatePct,
            isDefault: input.isDefault,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(LegalEntity.id, input.id),
              eq(LegalEntity.workspaceId, wsId),
            ),
          )
          .returning();

        await logAudit(ctx.db, ctx.user, {
          workspaceId: wsId,
          action: "legal_entity.update",
          entity: "legal_entity",
          entityId: input.id,
          newValue: { rif: input.rif, legalName: input.legalName },
        });
        return updated;
      }

      const [created] = await ctx.db
        .insert(LegalEntity)
        .values({
          workspaceId: wsId,
          rif: input.rif.trim().toUpperCase(),
          legalName: input.legalName.trim(),
          tradeName: input.tradeName?.trim(),
          fiscalAddress: input.fiscalAddress.trim(),
          taxpayerType: input.taxpayerType,
          isSpecialTaxpayer: input.isSpecialTaxpayer,
          retentionRatePct: input.retentionRatePct,
          isDefault: input.isDefault,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "legal_entity.create",
        entity: "legal_entity",
        entityId: created?.id,
        newValue: { rif: input.rif, legalName: input.legalName },
      });
      return created;
    }),

  listBranches: wsReadPermissionProcedure("settings", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select()
        .from(Branch)
        .where(eq(Branch.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(Branch.isMain), asc(Branch.name));
    },
  ),

  saveBranch: wsPermissionProcedure("settings", "update")
    .input(
      z.object({
        id: z.string().uuid().optional(),
        legalEntityId: z.string().uuid(),
        code: z.string().min(1).max(32),
        name: z.string().min(2).max(256),
        address: z.string().max(512).optional(),
        city: z.string().max(128).optional(),
        state: z.string().max(128).optional(),
        phone: z.string().max(64).optional(),
        invoiceSeriesPrefix: z.string().min(1).max(16).default("A"),
        controlNumberPrefix: z.string().min(1).max(16).default("00-"),
        defaultWarehouseId: z.string().uuid().optional(),
        isMain: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      if (input.id) {
        const [updated] = await ctx.db
          .update(Branch)
          .set({
            legalEntityId: input.legalEntityId,
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            address: input.address?.trim(),
            city: input.city?.trim(),
            state: input.state?.trim(),
            phone: input.phone?.trim(),
            invoiceSeriesPrefix: input.invoiceSeriesPrefix.trim().toUpperCase(),
            controlNumberPrefix: input.controlNumberPrefix.trim(),
            defaultWarehouseId: input.defaultWarehouseId,
            isMain: input.isMain,
            updatedAt: new Date(),
          })
          .where(and(eq(Branch.id, input.id), eq(Branch.workspaceId, wsId)))
          .returning();

        await logAudit(ctx.db, ctx.user, {
          workspaceId: wsId,
          action: "branch.update",
          entity: "branch",
          entityId: input.id,
          newValue: { code: input.code, name: input.name },
        });
        return updated;
      }

      const [created] = await ctx.db
        .insert(Branch)
        .values({
          workspaceId: wsId,
          legalEntityId: input.legalEntityId,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          address: input.address?.trim(),
          city: input.city?.trim(),
          state: input.state?.trim(),
          phone: input.phone?.trim(),
          invoiceSeriesPrefix: input.invoiceSeriesPrefix.trim().toUpperCase(),
          controlNumberPrefix: input.controlNumberPrefix.trim(),
          defaultWarehouseId: input.defaultWarehouseId,
          isMain: input.isMain,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "branch.create",
        entity: "branch",
        entityId: created?.id,
        newValue: { code: input.code, name: input.name },
      });
      return created;
    }),
});
