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
  ChannelAllocation,
  Container,
  ContainerDocument,
  ContainerItem,
  containerStatusEnum,
  Product,
  StockLedger,
  StockMovement,
  Warehouse,
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

  byId: wsReadPermissionProcedure("containers", "read")
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

      const [items, documents] = await Promise.all([
        ctx.db
          .select()
          .from(ContainerItem)
          .where(
            and(
              eq(ContainerItem.containerId, input.id),
              eq(ContainerItem.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
        ctx.db
          .select()
          .from(ContainerDocument)
          .where(
            and(
              eq(ContainerDocument.containerId, input.id),
              eq(ContainerDocument.workspaceId, ctx.workspace.workspaceId),
            ),
          )
          .orderBy(desc(ContainerDocument.createdAt)),
      ]);

      return { ...container, items, documents };
    }),

  addDocument: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        containerId: z.string().uuid(),
        documentType: z.string().min(1).max(64),
        fileUrl: z.string().url().max(2048),
        fileName: z.string().max(256).optional(),
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

      const [doc] = await ctx.db
        .insert(ContainerDocument)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          containerId: input.containerId,
          documentType: input.documentType,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          uploadedBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "container.document_add",
        entity: "container_document",
        entityId: doc?.id,
        newValue: {
          containerId: input.containerId,
          documentType: input.documentType,
        },
      });

      return doc;
    }),

  receiveItems: wsPermissionProcedure("containers", "update")
    .input(
      z.object({
        containerId: z.string().uuid(),
        warehouseId: z.string().uuid(),
        items: z
          .array(
            z.object({
              containerItemId: z.string().uuid(),
              productId: z.string().uuid(),
              quantityReceived: z.number().int().nonnegative(),
              unitCost: z.number().nonnegative().optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.workspace.workspaceId;

      const [container] = await ctx.db
        .select()
        .from(Container)
        .where(
          and(
            eq(Container.id, input.containerId),
            eq(Container.workspaceId, workspaceId),
          ),
        )
        .limit(1);

      if (!container) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contenedor no encontrado en este workspace",
        });
      }

      const [warehouse] = await ctx.db
        .select({ id: Warehouse.id })
        .from(Warehouse)
        .where(
          and(
            eq(Warehouse.id, input.warehouseId),
            eq(Warehouse.workspaceId, workspaceId),
          ),
        )
        .limit(1);

      if (!warehouse) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Almacén de recepción no encontrado en este workspace",
        });
      }

      let totalUnitsReceived = 0;

      for (const item of input.items) {
        await ctx.db
          .update(ContainerItem)
          .set({
            quantityReceived: item.quantityReceived,
            productId: item.productId,
            isMatched: true,
            ...(item.unitCost !== undefined ? { unitCost: item.unitCost } : {}),
          })
          .where(
            and(
              eq(ContainerItem.id, item.containerItemId),
              eq(ContainerItem.containerId, input.containerId),
              eq(ContainerItem.workspaceId, workspaceId),
            ),
          );

        if (item.quantityReceived <= 0) continue;
        totalUnitsReceived += item.quantityReceived;

        // Weighted average cost (costAvg) update on Product
        if (item.unitCost !== undefined && item.unitCost > 0) {
          const [prod] = await ctx.db
            .select({ costAvg: Product.costAvg })
            .from(Product)
            .where(
              and(
                eq(Product.id, item.productId),
                eq(Product.workspaceId, workspaceId),
              ),
            )
            .limit(1);

          const [stockAgg] = await ctx.db
            .select({
              totalQty: sql<number>`coalesce(sum(${StockLedger.quantity}), 0)`,
            })
            .from(StockLedger)
            .where(
              and(
                eq(StockLedger.productId, item.productId),
                eq(StockLedger.workspaceId, workspaceId),
              ),
            );

          const currentQty = Math.max(0, Number(stockAgg?.totalQty ?? 0));
          const currentCost = Math.max(
            0,
            parseFloat(String(prod?.costAvg ?? "0")) || 0,
          );
          const weightedCost =
            currentQty > 0
              ? (currentQty * currentCost +
                  item.quantityReceived * item.unitCost) /
                (currentQty + item.quantityReceived)
              : item.unitCost;

          await ctx.db
            .update(Product)
            .set({
              costAvg: weightedCost.toFixed(4),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(Product.id, item.productId),
                eq(Product.workspaceId, workspaceId),
              ),
            );
        }

        // Upsert StockLedger
        await ctx.db
          .insert(StockLedger)
          .values({
            workspaceId,
            productId: item.productId,
            warehouseId: input.warehouseId,
            quantity: item.quantityReceived,
          })
          .onConflictDoUpdate({
            target: [
              StockLedger.workspaceId,
              StockLedger.productId,
              StockLedger.warehouseId,
            ],
            set: {
              quantity: sql`${StockLedger.quantity} + ${item.quantityReceived}`,
              updatedAt: new Date(),
            },
          });

        // Auto-allocate received merchandise to the store channel so it is
        // immediately available for POS counter sales (PROP-04).
        await ctx.db
          .insert(ChannelAllocation)
          .values({
            workspaceId,
            productId: item.productId,
            channel: "store",
            quantity: item.quantityReceived,
          })
          .onConflictDoUpdate({
            target: [
              ChannelAllocation.workspaceId,
              ChannelAllocation.productId,
              ChannelAllocation.channel,
            ],
            set: {
              quantity: sql`${ChannelAllocation.quantity} + ${item.quantityReceived}`,
              updatedAt: new Date(),
            },
          });

        // Insert Kardex StockMovement
        await ctx.db.insert(StockMovement).values({
          workspaceId,
          productId: item.productId,
          warehouseId: input.warehouseId,
          movementType: "container_receipt",
          quantity: item.quantityReceived,
          toChannel: "store",
          referenceId: input.containerId,
          referenceType: "container",
          notes: `Recepción contenedor #${container.containerNumber}`,
          createdBy: ctx.user.id,
        });
      }

      if (container.status === "created" || container.status === "in_transit") {
        await ctx.db
          .update(Container)
          .set({ status: "received" })
          .where(
            and(
              eq(Container.id, input.containerId),
              eq(Container.workspaceId, workspaceId),
            ),
          );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId,
        action: "container.receive_items",
        entity: "container",
        entityId: input.containerId,
        newValue: {
          warehouseId: input.warehouseId,
          itemsProcessed: input.items.length,
          totalUnitsReceived,
        },
      });

      return {
        success: true,
        itemsProcessed: input.items.length,
        totalUnitsReceived,
      };
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
        workspaceId: ctx.workspace.workspaceId,
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
        workspaceId: ctx.workspace.workspaceId,
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
        workspaceId: ctx.workspace.workspaceId,
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
        workspaceId: ctx.workspace.workspaceId,
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
        workspaceId: ctx.workspace.workspaceId,
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
        workspaceId: ctx.workspace.workspaceId,
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

  /**
   * Hybrid / Semantic Search across Containers, Packing List Items, and Documents (F11.4).
   * Answers natural-language and keyword queries on container numbers, SKUs,
   * translated/original item names, categories, and shipping documents.
   */
  search: wsReadPermissionProcedure("containers", "read")
    .input(
      z.object({
        query: z.string().min(1).max(256),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const tokens = input.query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);

      const containers = await ctx.db
        .select()
        .from(Container)
        .where(eq(Container.workspaceId, wsId))
        .orderBy(desc(Container.createdAt))
        .limit(100);

      const items = await ctx.db
        .select()
        .from(ContainerItem)
        .where(eq(ContainerItem.workspaceId, wsId))
        .limit(300);

      const documents = await ctx.db
        .select()
        .from(ContainerDocument)
        .where(eq(ContainerDocument.workspaceId, wsId))
        .orderBy(desc(ContainerDocument.createdAt))
        .limit(100);

      const scoreText = (fields: (string | null | undefined)[]): number => {
        const haystack = fields
          .filter((f): f is string => Boolean(f))
          .join(" ")
          .toLowerCase();
        if (!haystack) return 0;
        let score = 0;
        if (haystack.includes(input.query.toLowerCase().trim())) {
          score += 5;
        }
        for (const token of tokens) {
          if (haystack.includes(token)) score += 2;
        }
        return score;
      };

      const containerById = new Map(containers.map((c) => [c.id, c]));

      const matchedContainers = containers
        .map((c) => ({
          container: c,
          score: scoreText([c.containerNumber, c.notes, c.status]),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map((entry) => entry.container);

      const matchedItems = items
        .map((item) => {
          const parent = containerById.get(item.containerId);
          return {
            item,
            containerNumber: parent?.containerNumber ?? "—",
            containerStatus: parent?.status ?? "created",
            score: scoreText([
              item.originalName,
              item.translatedName,
              item.skuHint,
              item.categoryHint,
              item.notes,
              parent?.containerNumber,
            ]),
          };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      const matchedDocuments = documents
        .map((doc) => {
          const parent = containerById.get(doc.containerId);
          return {
            document: doc,
            containerNumber: parent?.containerNumber ?? "—",
            score: scoreText([
              doc.documentType,
              doc.fileName,
              parent?.containerNumber,
            ]),
          };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      const totalFobMatched = matchedContainers.reduce(
        (sum, c) => sum + Number(c.costFob ?? 0),
        0,
      );

      return {
        query: input.query,
        matchedContainers,
        matchedItems,
        matchedDocuments,
        summary: {
          containersFound: matchedContainers.length,
          itemsFound: matchedItems.length,
          documentsFound: matchedDocuments.length,
          totalFobUsd: Math.round(totalFobMatched * 100) / 100,
        },
      };
    }),
});
