/**
 * Cendaro — Integrations Router
 *
 * Mercado Libre sync, WhatsApp orders, integration logs.
 * PRD §20: ML import/stock sync/shipping/alerts.
 * PRD §21: WhatsApp hybrid sales channel.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  IntegrationFailure,
  IntegrationLog,
  integrationLogLevelEnum,
  MercadolibreAccount,
  MercadolibreOrderEvent,
  MlListing,
  mlListingStatusEnum,
  MlOrder,
} from "@cendaro/db/schema";

import { encryptSecret } from "../services/crypto-vault";
import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const integrationsRouter = createTRPCRouter({
  // ─── ML Listings (PRD §20) ───────────────────

  listMlListings: wsReadPermissionProcedure("marketplace", "read")
    .input(
      z.object({
        status: z.enum(mlListingStatusEnum.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(MlListing.workspaceId, ctx.workspace.workspaceId)];
      if (input.status) {
        conditions.push(eq(MlListing.status, input.status));
      }
      return ctx.db
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
        .where(and(...conditions))
        .orderBy(desc(MlListing.createdAt))
        .limit(input.limit);
    }),

  syncMlListing: wsPermissionProcedure("marketplace", "update")
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
        .where(
          and(
            eq(MlListing.id, input.id),
            eq(MlListing.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "ml.sync",
        entity: "ml_listing",
        entityId: input.id,
        newValue: { stock: input.stock },
      });

      return updated;
    }),

  // ─── ML Orders (PRD §20) ────────────────────

  listMlOrders: wsReadPermissionProcedure("marketplace", "read")
    .input(
      z.object({
        imported: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(MlOrder.workspaceId, ctx.workspace.workspaceId)];
      if (input.imported !== undefined) {
        conditions.push(eq(MlOrder.isImported, input.imported));
      }
      return ctx.db
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
        .where(and(...conditions))
        .orderBy(desc(MlOrder.createdAt))
        .limit(input.limit);
    }),

  importMlOrder: wsPermissionProcedure("marketplace", "create")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(MlOrder)
        .set({ isImported: true, importedAt: new Date() })
        .where(
          and(
            eq(MlOrder.id, input.id),
            eq(MlOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "ml.import_order",
        entity: "ml_order",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Integration Logs (PRD §20 alerts) ──────

  listLogs: wsReadPermissionProcedure("marketplace", "read")
    .input(
      z.object({
        source: z.string().optional(),
        level: z.enum(integrationLogLevelEnum.enumValues).optional(),
        resolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(IntegrationLog.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input.source) {
        conditions.push(eq(IntegrationLog.source, input.source));
      }
      if (input.level) {
        conditions.push(eq(IntegrationLog.level, input.level));
      }
      if (input.resolved !== undefined) {
        conditions.push(eq(IntegrationLog.isResolved, input.resolved));
      }
      return ctx.db
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
        .where(and(...conditions))
        .orderBy(desc(IntegrationLog.createdAt))
        .limit(input.limit);
    }),

  unresolvedAlerts: wsReadPermissionProcedure("marketplace", "read").query(
    async ({ ctx }) => {
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
            eq(IntegrationLog.workspaceId, ctx.workspace.workspaceId),
            eq(IntegrationLog.isResolved, false),
            eq(IntegrationLog.level, "error"),
          ),
        )
        .orderBy(desc(IntegrationLog.createdAt))
        .limit(50);
    },
  ),

  resolveLog: wsPermissionProcedure("marketplace", "update")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(IntegrationLog)
        .set({ isResolved: true, resolvedBy: ctx.user.id })
        .where(
          and(
            eq(IntegrationLog.id, input.id),
            eq(IntegrationLog.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "integration.resolve",
        entity: "integration_log",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── ML Accounts, Webhook Events & DLQ Failures (PRD v2.0, F11.3) ───

  listMlAccounts: wsReadPermissionProcedure("marketplace", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select()
        .from(MercadolibreAccount)
        .where(eq(MercadolibreAccount.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(MercadolibreAccount.createdAt));
    },
  ),

  connectMlAccount: wsPermissionProcedure("marketplace", "create")
    .input(
      z.object({
        nickname: z.string().min(2).max(128),
        mlUserId: z.string().min(2).max(64),
        accessToken: z.string().min(8).max(2048).optional(),
        refreshToken: z.string().min(8).max(2048).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const encryptedAccess = input.accessToken
        ? encryptSecret(input.accessToken)
        : null;
      const encryptedRefresh = input.refreshToken
        ? encryptSecret(input.refreshToken)
        : null;

      const [account] = await ctx.db
        .insert(MercadolibreAccount)
        .values({
          workspaceId: wsId,
          nickname: input.nickname.trim(),
          mlUserId: input.mlUserId.trim(),
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [
            MercadolibreAccount.workspaceId,
            MercadolibreAccount.mlUserId,
          ],
          set: {
            nickname: input.nickname.trim(),
            isActive: true,
          },
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "ml.account_connect",
        entity: "mercadolibre_account",
        entityId: account?.id,
        newValue: {
          nickname: input.nickname,
          mlUserId: input.mlUserId,
          hasEncryptedAccessToken: Boolean(encryptedAccess),
          hasEncryptedRefreshToken: Boolean(encryptedRefresh),
          vaultPrefix: encryptedAccess?.slice(0, 12),
        },
      });

      return account;
    }),

  listOrderEvents: wsReadPermissionProcedure("marketplace", "read")
    .input(
      z
        .object({
          mlOrderId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(MercadolibreOrderEvent.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input?.mlOrderId) {
        conditions.push(eq(MercadolibreOrderEvent.mlOrderId, input.mlOrderId));
      }
      return ctx.db
        .select()
        .from(MercadolibreOrderEvent)
        .where(and(...conditions))
        .orderBy(desc(MercadolibreOrderEvent.createdAt))
        .limit(input?.limit ?? 50);
    }),

  ingestOrderWebhook: wsPermissionProcedure("marketplace", "create")
    .input(
      z.object({
        mlOrderId: z.string().uuid().optional(),
        eventType: z.string().min(2).max(64),
        payload: z.record(z.string(), z.unknown()),
        simulateFailureMessage: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;

      const [event] = await ctx.db
        .insert(MercadolibreOrderEvent)
        .values({
          workspaceId: wsId,
          mlOrderId: input.mlOrderId,
          eventType: input.eventType,
          payload: input.payload,
          processedAt: input.simulateFailureMessage ? null : new Date(),
        })
        .returning();

      if (input.simulateFailureMessage) {
        const [failure] = await ctx.db
          .insert(IntegrationFailure)
          .values({
            workspaceId: wsId,
            source: "mercadolibre",
            errorCode: "ML_WEBHOOK_PROCESSING_ERROR",
            errorMessage: input.simulateFailureMessage,
            payload: {
              eventId: event?.id,
              eventType: input.eventType,
              ...input.payload,
            },
            retryCount: 0,
            maxRetries: 3,
            isResolved: false,
          })
          .returning();

        return { event, failure, status: "queued_dlq" as const };
      }

      return { event, failure: null, status: "processed" as const };
    }),

  listIntegrationFailures: wsReadPermissionProcedure("marketplace", "read")
    .input(
      z
        .object({
          resolved: z.boolean().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(IntegrationFailure.workspaceId, ctx.workspace.workspaceId),
      ];
      if (input?.resolved !== undefined) {
        conditions.push(eq(IntegrationFailure.isResolved, input.resolved));
      }
      return ctx.db
        .select()
        .from(IntegrationFailure)
        .where(and(...conditions))
        .orderBy(desc(IntegrationFailure.createdAt))
        .limit(input?.limit ?? 50);
    }),

  retryIntegrationFailure: wsPermissionProcedure("marketplace", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        markResolved: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const [existing] = await ctx.db
        .select()
        .from(IntegrationFailure)
        .where(
          and(
            eq(IntegrationFailure.id, input.id),
            eq(IntegrationFailure.workspaceId, wsId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fallo de integración no encontrado en DLQ",
        });
      }

      if (existing.retryCount >= existing.maxRetries && !input.markResolved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "El evento alcanzó el máximo de reintentos automáticos en DLQ",
        });
      }

      const [updated] = await ctx.db
        .update(IntegrationFailure)
        .set({
          retryCount: sql`${IntegrationFailure.retryCount} + 1`,
          isResolved: input.markResolved,
          resolvedBy: input.markResolved ? ctx.user.id : null,
          resolvedAt: input.markResolved ? new Date() : null,
        })
        .where(
          and(
            eq(IntegrationFailure.id, input.id),
            eq(IntegrationFailure.workspaceId, wsId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: wsId,
        action: "integration.dlq_retry",
        entity: "integration_failure",
        entityId: input.id,
        newValue: {
          markResolved: input.markResolved,
          nextRetryCount: existing.retryCount + 1,
        },
      });

      return updated;
    }),
});
