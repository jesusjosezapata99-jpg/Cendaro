/**
 * Cendaro — Container Router
 *
 * Container/import lifecycle management.
 * PRD §13: packing list upload, 4-state flow, admin-only release.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AiPromptConfig,
  Brand,
  Category,
  Container,
  ContainerItem,
  containerStatusEnum,
  Product,
} from "@cendaro/db/schema";
import { can } from "@cendaro/validators";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const containerRouter = createTRPCRouter({
  list: wsReadPermissionProcedure("containers", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select()
        .from(Container)
        .where(eq(Container.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(Container.createdAt));
    },
  ),

  byId: wsPermissionProcedure("containers", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [container] = await ctx.db
        .select()
        .from(Container)
        .where(
          and(
            eq(Container.id, input.id),
            eq(Container.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!container) return null;

      const items = await ctx.db
        .select()
        .from(ContainerItem)
        .where(
          and(
            eq(ContainerItem.containerId, input.id),
            eq(ContainerItem.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      return { ...container, items };
    }),

  create: wsPermissionProcedure("containers", "create")
    .input(
      z.object({
        containerNumber: z.string().min(1).max(64),
        supplierId: z.string().uuid().optional(),
        departureDate: z.string().datetime().optional(),
        arrivalDate: z.string().datetime().optional(),
        costFob: z.number().nonnegative().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [container] = await ctx.db
        .insert(Container)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
          departureDate: input.departureDate
            ? new Date(input.departureDate)
            : null,
          arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "container.create",
        entity: "container",
        entityId: container?.id,
        newValue: { containerNumber: input.containerNumber },
      });

      return container;
    }),

  updateStatus: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(containerStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Closing releases the container: containers.approve (owner/admin).
      if (
        input.status === "closed" &&
        !can(ctx.workspace.role, "containers", "approve")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo administradores pueden cerrar o liberar contenedores",
        });
      }

      const setCols: Record<string, unknown> = { status: input.status };
      if (input.status === "closed") {
        setCols.closedBy = ctx.user.id;
        setCols.closedAt = new Date();
      }

      const [updated] = await ctx.db
        .update(Container)
        .set(setCols)
        .where(
          and(
            eq(Container.id, input.id),
            eq(Container.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contenedor no encontrado en este workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: `container.status_${input.status}`,
        entity: "container",
        entityId: input.id,
        newValue: { status: input.status },
      });

      return updated;
    }),

  addItems: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        containerId: z.string().uuid(),
        items: z.array(
          z.object({
            productId: z.string().uuid(),
            quantityExpected: z.number().int().positive(),
            unitCost: z.number().nonnegative().optional(),
            notes: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [container] = await ctx.db
        .select({ id: Container.id })
        .from(Container)
        .where(
          and(
            eq(Container.id, input.containerId),
            eq(Container.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!container) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contenedor no encontrado en este workspace",
        });
      }

      if (input.items.length > 0) {
        await ctx.db.insert(ContainerItem).values(
          input.items.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            containerId: input.containerId,
            ...item,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        action: "container.add_items",
        entity: "container_item",
        entityId: input.containerId,
        newValue: { count: input.items.length },
      });

      return { success: true };
    }),

  // ── AI Prompt Config ───────────────────────────────
  getAIPromptConfig: wsReadPermissionProcedure("containers", "read").query(
    async ({ ctx }) => {
      const [config] = await ctx.db
        .select()
        .from(AiPromptConfig)
        .where(
          and(
            eq(AiPromptConfig.workspaceId, ctx.workspace.workspaceId),
            eq(AiPromptConfig.active, true),
          ),
        )
        .limit(1);
      return config ?? null;
    },
  ),

  updateAIPromptConfig: wsPermissionProcedure("settings", "update")
    .input(
      z.object({
        configKey: z.string().min(1).max(64),
        systemPrompt: z.string().min(10).max(20_000),
        businessContext: z.string().max(20_000).nullable().optional(),
        categoryRules: z.string().max(20_000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(AiPromptConfig)
        .where(
          and(
            eq(AiPromptConfig.workspaceId, ctx.workspace.workspaceId),
            eq(AiPromptConfig.configKey, input.configKey),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await ctx.db
          .update(AiPromptConfig)
          .set({
            systemPrompt: input.systemPrompt,
            businessContext: input.businessContext ?? null,
            categoryRules: input.categoryRules ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(AiPromptConfig.id, existing.id),
              eq(AiPromptConfig.workspaceId, ctx.workspace.workspaceId),
            ),
          )
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(AiPromptConfig)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "ai.update_prompt_config",
        entity: "ai_prompt_config",
        entityId: created?.id,
        newValue: { configKey: input.configKey },
      });

      return created;
    }),

  // ── Catalog Snapshot (for context injection) ──────
  getCatalogSnapshot: wsReadPermissionProcedure("containers", "read").query(
    async ({ ctx }) => {
      const categories = await ctx.db
        .select({ id: Category.id, name: Category.name, slug: Category.slug })
        .from(Category)
        .where(eq(Category.workspaceId, ctx.workspace.workspaceId))
        .limit(200);

      const brands = await ctx.db
        .select({ id: Brand.id, name: Brand.name })
        .from(Brand)
        .where(eq(Brand.workspaceId, ctx.workspace.workspaceId))
        .limit(100);

      const products = await ctx.db
        .select({
          id: Product.id,
          sku: Product.sku,
          name: Product.name,
          categoryId: Product.categoryId,
          brandId: Product.brandId,
        })
        .from(Product)
        .where(eq(Product.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(Product.createdAt))
        .limit(100);

      return { categories, brands, products };
    },
  ),

  // ── Confirm with Matching (v2) ───────────────────
  confirmWithMatching: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        containerId: z.string().uuid(),
        items: z.array(
          z.object({
            originalName: z.string(),
            translatedName: z.string(),
            quantity: z.number().int().positive(),
            unitCost: z.number().nonnegative().nullable(),
            weightKg: z.number().nonnegative().nullable(),
            skuHint: z.string().nullable(),
            categoryHint: z.string().nullable(),
            confidence: z.number().min(0).max(100).nullable(),
            suggestedProductId: z.string().uuid().nullable(),
            matchType: z.enum([
              "exact_sku",
              "name_similarity",
              "ai_only",
              "no_match",
              "manual",
            ]),
            createProduct: z.boolean().default(false),
            aiCorrected: z.boolean().default(false),
            imageUrl: z.string().url().nullable().optional(),
            imageDescription: z.string().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify container belongs to current workspace
      const [container] = await ctx.db
        .select({ id: Container.id })
        .from(Container)
        .where(
          and(
            eq(Container.id, input.containerId),
            eq(Container.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!container) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contenedor no encontrado en este workspace",
        });
      }

      let created = 0;
      let linked = 0;
      let unmatched = 0;

      // Phase 1: Resolve product IDs (sequential — needs returned IDs)
      const resolvedItems: {
        productId: string | null;
        item: (typeof input.items)[number];
      }[] = [];

      for (const item of input.items) {
        let productId = item.suggestedProductId;

        if (item.createProduct && !productId) {
          const [newProduct] = await ctx.db
            .insert(Product)
            .values({
              workspaceId: ctx.workspace.workspaceId,
              sku:
                item.skuHint ??
                `AI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: item.translatedName,
              weight: item.weightKg,
              costAvg: item.unitCost != null ? String(item.unitCost) : "0",
              status: "draft",
            })
            .returning();
          productId = newProduct?.id ?? null;
          created++;
        }

        if (productId) linked++;
        else unmatched++;

        resolvedItems.push({ productId, item });
      }

      // Phase 2: Batch insert ContainerItems (500 per batch)
      const batchSize = 500;
      for (let i = 0; i < resolvedItems.length; i += batchSize) {
        const batch = resolvedItems.slice(i, i + batchSize);
        await ctx.db.insert(ContainerItem).values(
          batch.map(({ productId, item }) => ({
            workspaceId: ctx.workspace.workspaceId,
            containerId: input.containerId,
            productId: productId,
            quantityExpected: item.quantity,
            unitCost: item.unitCost,
            originalName: item.originalName,
            translatedName: item.translatedName,
            weightKg: item.weightKg,
            skuHint: item.skuHint,
            categoryHint: item.categoryHint,
            confidence: item.confidence ? item.confidence / 100 : null,
            suggestedProductId: item.suggestedProductId,
            isMatched: !!productId,
            aiCorrected: item.aiCorrected,
            imageUrl: item.imageUrl ?? null,
            imageDescription: item.imageDescription ?? null,
          })),
        );
      }

      // Update container metadata
      await ctx.db
        .update(Container)
        .set({
          packingListStatus: "completed",
          packingListProcessedAt: new Date(),
          packingListItemCount: input.items.length,
        })
        .where(
          and(
            eq(Container.id, input.containerId),
            eq(Container.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        action: "container.confirm_packing_list_v2",
        entity: "container",
        entityId: input.containerId,
        newValue: { total: input.items.length, created, linked, unmatched },
      });

      return {
        success: true,
        total: input.items.length,
        created,
        linked,
        unmatched,
      };
    }),

  // ── Save Correction (few-shot learning) ──────────
  saveCorrection: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        original: z.string(),
        wrong: z.string().optional(),
        correct: z.string(),
        category: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [config] = await ctx.db
        .select()
        .from(AiPromptConfig)
        .where(
          and(
            eq(AiPromptConfig.workspaceId, ctx.workspace.workspaceId),
            eq(AiPromptConfig.active, true),
          ),
        )
        .limit(1);

      if (!config) return { success: false, error: "No prompt config found" };

      const examples = Array.isArray(config.fewShotExamples)
        ? (config.fewShotExamples as Record<string, string>[])
        : [];

      // Add new correction, keep max 15
      examples.push({
        original: input.original,
        ...(input.wrong ? { wrong: input.wrong } : {}),
        correct: input.correct,
        ...(input.category ? { category: input.category } : {}),
      });

      const trimmed = examples.slice(-15);

      await ctx.db
        .update(AiPromptConfig)
        .set({
          fewShotExamples: sql`${JSON.stringify(trimmed)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(AiPromptConfig.id, config.id),
            eq(AiPromptConfig.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        action: "ai.save_correction",
        entity: "ai_prompt_config",
        entityId: config.id,
        newValue: { original: input.original, correct: input.correct },
      });

      return { success: true, totalExamples: trimmed.length };
    }),

  /** Get packing list items for a container (paginated for virtual scroll) */
  getPackingListItems: wsReadPermissionProcedure("containers", "read")
    .input(
      z.object({
        containerId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select()
        .from(ContainerItem)
        .where(
          and(
            eq(ContainerItem.containerId, input.containerId),
            eq(ContainerItem.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),
});
