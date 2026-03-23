/**
 * Cendaro — Integrations Router
 *
 * Mercado Libre sync, WhatsApp orders, integration logs.
 * PRD §20: ML import/stock sync/shipping/alerts.
 * PRD §21: WhatsApp hybrid sales channel.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
  IntegrationLog,
  integrationLogLevelEnum,
  MlListing,
  mlListingStatusEnum,
  MlOrder,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const integrationsRouter = createTRPCRouter({
  // ─── ML Listings (PRD §20) ───────────────────

  listMlListings: workspaceProcedure
    .input(
      z.object({
        status: z.enum(mlListingStatusEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: MlListing.id,
          productId: MlListing.productId,
          mlItemId: MlListing.mlItemId,
          title: MlListing.title,
          status: MlListing.status,
          price: MlListing.price,
          stockSynced: MlListing.stockSynced,
          lastSyncAt: MlListing.lastSyncAt,
          createdAt: MlListing.createdAt,
        })
        .from(MlListing)
        .$dynamic();
      if (input.status) {
        query = query.where(eq(MlListing.status, input.status));
      }
      return query.orderBy(desc(MlListing.createdAt)).limit(input.limit);
    }),

  syncMlListing: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stock: z.number().int().nonnegative(),
        price: z.number().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(MlListing)
        .set({
          stockSynced: input.stock,
          ...(input.price !== undefined ? { price: input.price } : {}),
          lastSyncAt: new Date(),
          status: input.stock === 0 ? "out_of_stock" : "active",
        })
        .where(eq(MlListing.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "ml.sync",
        entity: "ml_listing",
        entityId: input.id,
        newValue: { stock: input.stock },
      });

      return updated;
    }),

  // ─── ML Orders (PRD §20) ────────────────────

  listMlOrders: workspaceProcedure
    .input(
      z.object({
        imported: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: MlOrder.id,
          mlOrderId: MlOrder.mlOrderId,
          buyerNickname: MlOrder.buyerNickname,
          unitPrice: MlOrder.unitPrice,
          quantity: MlOrder.quantity,
          shippingStatus: MlOrder.shippingStatus,
          isImported: MlOrder.isImported,
          createdAt: MlOrder.createdAt,
        })
        .from(MlOrder)
        .$dynamic();
      if (input.imported !== undefined) {
        query = query.where(eq(MlOrder.isImported, input.imported));
      }
      return query.orderBy(desc(MlOrder.createdAt)).limit(input.limit);
    }),

  importMlOrder: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(MlOrder)
        .set({ isImported: true, importedAt: new Date() })
        .where(eq(MlOrder.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "ml.import_order",
        entity: "ml_order",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Integration Logs (PRD §20 alerts) ──────

  listLogs: workspaceProcedure
    .input(
      z.object({
        source: z.string().optional(),
        level: z.enum(integrationLogLevelEnum.enumValues).optional(),
        resolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select({
          id: IntegrationLog.id,
          source: IntegrationLog.source,
          level: IntegrationLog.level,
          message: IntegrationLog.message,
          isResolved: IntegrationLog.isResolved,
          resolvedBy: IntegrationLog.resolvedBy,
          createdAt: IntegrationLog.createdAt,
        })
        .from(IntegrationLog)
        .$dynamic();
      if (input.source) {
        query = query.where(eq(IntegrationLog.source, input.source));
      }
      if (input.level) {
        query = query.where(eq(IntegrationLog.level, input.level));
      }
      if (input.resolved !== undefined) {
        query = query.where(eq(IntegrationLog.isResolved, input.resolved));
      }
      return query.orderBy(desc(IntegrationLog.createdAt)).limit(input.limit);
    }),

  unresolvedAlerts: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: IntegrationLog.id,
        source: IntegrationLog.source,
        level: IntegrationLog.level,
        message: IntegrationLog.message,
        createdAt: IntegrationLog.createdAt,
      })
      .from(IntegrationLog)
      .where(
        and(
          eq(IntegrationLog.isResolved, false),
          eq(IntegrationLog.level, "error"),
        ),
      )
      .orderBy(desc(IntegrationLog.createdAt))
      .limit(50);
  }),

  resolveLog: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(IntegrationLog)
        .set({ isResolved: true, resolvedBy: ctx.user.id })
        .where(eq(IntegrationLog.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "integration.resolve",
        entity: "integration_log",
        entityId: input.id,
      });

      return updated;
    }),
});
