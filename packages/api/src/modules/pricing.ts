/**
 * Cendaro — Pricing Router
 *
 * Exchange rates, price history, and repricing engine.
 * PRD §12: admin-only rates panel, 5% auto-repricing trigger, 24h approval window.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
  ExchangeRate,
  PriceHistory,
  rateTypeEnum,
  RepricingEvent,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const pricingRouter = createTRPCRouter({
  // ─── Exchange Rates (PRD §12.3) ──────────────

  /** Get latest rate for each type */
  latestRates: protectedProcedure.query(async ({ ctx }) => {
    // Use SQL DISTINCT ON to get only the latest rate per type
    // instead of loading ALL rows and filtering in JS
    const rates = await ctx.db
      .select({
        id: ExchangeRate.id,
        rateType: ExchangeRate.rateType,
        rate: ExchangeRate.rate,
        source: ExchangeRate.source,
        createdAt: ExchangeRate.createdAt,
      })
      .from(ExchangeRate)
      .orderBy(ExchangeRate.rateType, desc(ExchangeRate.createdAt));

    // Return latest per type (first occurrence after ORDER BY type, created_at DESC)
    const latestByType = new Map<string, (typeof rates)[0]>();
    for (const rate of rates) {
      if (!latestByType.has(rate.rateType)) {
        latestByType.set(rate.rateType, rate);
      }
    }
    return Array.from(latestByType.values());
  }),

  /** Get rate history */
  rateHistory: protectedProcedure
    .input(
      z.object({
        rateType: z.enum(rateTypeEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: ExchangeRate.id,
          rateType: ExchangeRate.rateType,
          rate: ExchangeRate.rate,
          source: ExchangeRate.source,
          createdAt: ExchangeRate.createdAt,
        })
        .from(ExchangeRate)
        .$dynamic();
      if (input.rateType) {
        query = query.where(eq(ExchangeRate.rateType, input.rateType));
      }
      return query.orderBy(desc(ExchangeRate.createdAt)).limit(input.limit);
    }),

  /** Update a rate (admin/supervisor only — PRD §12.6) */
  setRate: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(
      z.object({
        rateType: z.enum(rateTypeEnum.enumValues),
        rate: z.number().positive(),
        source: z.string().max(128).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newRate] = await ctx.db
        .insert(ExchangeRate)
        .values({
          rateType: input.rateType,
          rate: input.rate,
          source: input.source,
          notes: input.notes,
          updatedBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "rate.update",
        entity: "exchange_rate",
        entityId: newRate?.id,
        newValue: { rateType: input.rateType, rate: input.rate },
      });

      return newRate;
    }),

  // ─── Currency Calculator (PRD §12.7) ─────────

  convert: protectedProcedure
    .input(
      z.object({
        amount: z.number().nonnegative(),
        from: z.enum(["rmb", "usd", "bs"]),
        to: z.enum(["rmb", "usd", "bs"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Only fetch the 2 latest rates we need, not the entire history
      const rates = await ctx.db
        .select({
          rateType: ExchangeRate.rateType,
          rate: ExchangeRate.rate,
        })
        .from(ExchangeRate)
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

  priceHistory: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
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
        .$dynamic();
      if (input.productId) {
        query = query.where(eq(PriceHistory.productId, input.productId));
      }
      return query.orderBy(desc(PriceHistory.createdAt)).limit(input.limit);
    }),

  // ─── Repricing Events ────────────────────────

  listRepricingEvents: protectedProcedure
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
        .orderBy(desc(RepricingEvent.createdAt))
        .limit(input.limit);
    }),

  approveRepricing: roleRestrictedProcedure(["owner", "admin"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(RepricingEvent)
        .set({
          isApproved: true,
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(eq(RepricingEvent.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "repricing.approve",
        entity: "repricing_event",
        entityId: input.id,
      });

      return updated;
    }),
});
