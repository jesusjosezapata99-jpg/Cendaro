/**
 * Cendaro — Pricing Router
 *
 * Exchange rates, price history, and repricing engine.
 * PRD §12: admin-only rates panel, 5% auto-repricing trigger, 24h approval window.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
  ExchangeRate,
  PriceHistory,
  rateTypeEnum,
  RepricingEvent,
} from "@cendaro/db/schema";

import type { UpstreamRate, VesRates } from "../services/exchange-rate-sources";
import type { HeldRate, RateSyncResult } from "./rate-sync";
import { getUsdCnyRate, getVesRates } from "../services/exchange-rate-sources";
import {
  createTRPCRouter,
  memberReadProcedure,
  runInWorkspaceRls,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import {
  listHeldRates,
  syncAutomaticRates,
  toRateCandidates,
} from "./rate-sync";

export interface SyncRatesResult {
  results: RateSyncResult[];
  /** Live upstream values, so the page can show them without another fetch. */
  live: { ves: VesRates | null; cny: UpstreamRate | null };
}

export const pricingRouter = createTRPCRouter({
  // ─── Exchange Rates (PRD §12.3) ──────────────

  /** Get latest rate for each type */
  latestRates: memberReadProcedure.query(async ({ ctx }) => {
    const allRates = await ctx.db
      .select({
        id: ExchangeRate.id,
        rateType: ExchangeRate.rateType,
        rate: ExchangeRate.rate,
        source: ExchangeRate.source,
        createdAt: ExchangeRate.createdAt,
      })
      .from(ExchangeRate)
      .where(eq(ExchangeRate.workspaceId, ctx.workspace.workspaceId))
      .orderBy(ExchangeRate.rateType, desc(ExchangeRate.createdAt));

    // Deduplicate: keep only the latest per rateType
    const seen = new Set<string>();
    const latest = allRates.filter((r) => {
      if (seen.has(r.rateType)) return false;
      seen.add(r.rateType);
      return true;
    });

    return latest;
  }),

  /** Get rate history */
  rateHistory: wsReadPermissionProcedure("rates", "read")
    .input(
      z.object({
        rateType: z.enum(rateTypeEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(ExchangeRate.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.rateType) {
        conditions.push(eq(ExchangeRate.rateType, input.rateType));
      }
      return ctx.db
        .select({
          id: ExchangeRate.id,
          rateType: ExchangeRate.rateType,
          rate: ExchangeRate.rate,
          source: ExchangeRate.source,
          createdAt: ExchangeRate.createdAt,
        })
        .from(ExchangeRate)
        .where(and(...conditions))
        .orderBy(desc(ExchangeRate.createdAt))
        .limit(input.limit);
    }),

  /**
   * Refresh this workspace's automatic rates (PRD §12.6: no human-entered
   * rates; PLAN-2026-09-SECURITY-REMEDIATION F4.1).
   *
   * The server fetches BCV / DolarAPI / Frankfurter itself: the client only
   * asks for a refresh and can no longer choose a rate or its source (the
   * former setRate trusted both). Jumps beyond ±15 % are held for approval
   * (modules/rate-sync). Built on the read builder on purpose: the upstream
   * fetch can take seconds, so it runs before the short RLS transaction that
   * writes, instead of holding a pooled connection open meanwhile.
   */
  syncRates: wsReadPermissionProcedure("rates", "update")
    .input(z.object({ force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }): Promise<SyncRatesResult> => {
      const [ves, cny] = await Promise.all([
        getVesRates({ fresh: input.force }),
        getUsdCnyRate({ fresh: input.force }),
      ]);
      const candidates = toRateCandidates(ves, cny);
      const workspaceId = ctx.workspace.workspaceId;
      const results =
        candidates.length === 0
          ? []
          : await runInWorkspaceRls(ctx.db, workspaceId, (tx) =>
              syncAutomaticRates(tx, ctx.user, workspaceId, candidates),
            );
      return { results, live: { ves, cny } };
    }),

  /** Rates held for a decision because they jumped beyond ±15 % (F4.1). */
  heldRates: wsReadPermissionProcedure("rates", "read").query(
    ({ ctx }): Promise<HeldRate[]> =>
      listHeldRates(ctx.db, ctx.workspace.workspaceId),
  ),

  // ─── Currency Calculator (PRD §12.7) ─────────

  convert: memberReadProcedure
    .input(
      z.object({
        amount: z.number().nonnegative(),
        from: z.enum(["rmb", "usd", "bs"]),
        to: z.enum(["rmb", "usd", "bs"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Only fetch the 2 latest rates we need for this workspace
      const rates = await ctx.db
        .select({
          rateType: ExchangeRate.rateType,
          rate: ExchangeRate.rate,
        })
        .from(ExchangeRate)
        .where(eq(ExchangeRate.workspaceId, ctx.workspace.workspaceId))
        .orderBy(ExchangeRate.rateType, desc(ExchangeRate.createdAt))
        .limit(20); // Safety limit — only ~4 rate types exist

      const latestByType = new Map<string, number>();
      for (const r of rates) {
        if (!latestByType.has(r.rateType)) {
          latestByType.set(r.rateType, r.rate);
        }
      }

      const bcv = latestByType.get("bcv") ?? 1;
      const rmbUsd = latestByType.get("rmb_usd") ?? 1;

      let result = input.amount;

      if (input.from === "rmb" && input.to === "usd") {
        result = input.amount / rmbUsd;
      } else if (input.from === "usd" && input.to === "bs") {
        result = input.amount * bcv;
      } else if (input.from === "rmb" && input.to === "bs") {
        result = (input.amount / rmbUsd) * bcv;
      } else if (input.from === "bs" && input.to === "usd") {
        result = input.amount / bcv;
      } else if (input.from === "usd" && input.to === "rmb") {
        result = input.amount * rmbUsd;
      } else if (input.from === "bs" && input.to === "rmb") {
        result = (input.amount / bcv) * rmbUsd;
      }

      return { result, ratesUsed: { bcv, rmbUsd } };
    }),

  // ─── Price History (PRD §12.8) ───────────────

  priceHistory: wsReadPermissionProcedure("pricing", "read")
    .input(
      z.object({
        productId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(PriceHistory.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.productId) {
        conditions.push(eq(PriceHistory.productId, input.productId));
      }
      return ctx.db
        .select({
          id: PriceHistory.id,
          productId: PriceHistory.productId,
          priceType: PriceHistory.priceType,
          oldAmountUsd: PriceHistory.oldAmountUsd,
          newAmountUsd: PriceHistory.newAmountUsd,
          rateUsed: PriceHistory.rateUsed,
          trigger: PriceHistory.trigger,
          createdAt: PriceHistory.createdAt,
        })
        .from(PriceHistory)
        .where(and(...conditions))
        .orderBy(desc(PriceHistory.createdAt))
        .limit(input.limit);
    }),

  // ─── Repricing Events ────────────────────────

  listRepricingEvents: wsReadPermissionProcedure("pricing", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: RepricingEvent.id,
          trigger: RepricingEvent.trigger,
          rateType: RepricingEvent.rateType,
          oldRate: RepricingEvent.oldRate,
          newRate: RepricingEvent.newRate,
          variationPct: RepricingEvent.variationPct,
          productsAffected: RepricingEvent.productsAffected,
          isApproved: RepricingEvent.isApproved,
          approvedBy: RepricingEvent.approvedBy,
          approvedAt: RepricingEvent.approvedAt,
          createdAt: RepricingEvent.createdAt,
        })
        .from(RepricingEvent)
        .where(eq(RepricingEvent.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(RepricingEvent.createdAt))
        .limit(input.limit);
    }),

  approveRepricing: wsPermissionProcedure("pricing", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo propietarios y administradores pueden aprobar eventos de repricing",
        });
      }

      const [updated] = await ctx.db
        .update(RepricingEvent)
        .set({
          isApproved: true,
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(RepricingEvent.id, input.id),
            eq(RepricingEvent.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evento de repricing no encontrado en este workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "repricing.approve",
        entity: "repricing_event",
        entityId: input.id,
      });

      return updated;
    }),
});
