/**
 * Cendaro — Container Router
 *
 * Container/import lifecycle management.
 * PRD §13: packing list upload, 4-state flow, admin-only release.
 */
import { z } from "zod/v4";
import { desc, eq } from "drizzle-orm";

import {
  Container,
  ContainerItem,
  Product,
  containerStatusEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

/** Generate a URL-safe slug from a string */
function _toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

/** Generate a short pseudo-unique SKU suffix */
function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const confirmItemSchema = z.object({
  originalName: z.string(),
  translatedName: z.string(),
  quantity: z.number().int().nonnegative(),
  unitCost: z.number().nullable(),
  weightKg: z.number().nullable(),
  skuHint: z.string().nullable(),
  categoryHint: z.string().nullable(),
  confidence: z.number(),
  suggestedProductId: z.string().uuid().nullable(),
  matchType: z.enum(["exact_sku", "name_similarity", "ai_only", "no_match"]),
  createProduct: z.boolean(),
  aiCorrected: z.boolean(),
  imageUrl: z.string().optional(),
  imageDescription: z.string().optional(),
});

export const containerRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(Container)
      .orderBy(desc(Container.createdAt));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [container] = await ctx.db
        .select()
        .from(Container)
        .where(eq(Container.id, input.id))
        .limit(1);

      if (!container) return null;

      const items = await ctx.db
        .select()
        .from(ContainerItem)
        .where(eq(ContainerItem.containerId, input.id));

      return { ...container, items };
    }),

  create: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
          departureDate: input.departureDate ? new Date(input.departureDate) : null,
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

  updateStatus: roleRestrictedProcedure(["owner", "admin"])
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(containerStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setCols: Record<string, unknown> = { status: input.status };
      if (input.status === "closed") {
        setCols.closedBy = ctx.user.id;
        setCols.closedAt = new Date();
      }

      const [updated] = await ctx.db
        .update(Container)
        .set(setCols)
        .where(eq(Container.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: `container.status_${input.status}`,
        entity: "container",
        entityId: input.id,
        newValue: { status: input.status },
      });

      return updated;
    }),

  addItems: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
      if (input.items.length > 0) {
        await ctx.db.insert(ContainerItem).values(
          input.items.map((item) => ({
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

  /**
   * Confirm AI-parsed packing list items.
   * Inserts items from the AI analysis into the container.
   * productId is optional — AI creates items before product assignment.
   */
  confirmWithMatching: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(
      z.object({
        containerId: z.string().uuid(),
        items: z.array(confirmItemSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const containerItemRows: {
        containerId: string;
        productId: string | null;
        quantityExpected: number;
        unitCost: number | null;
        notes: string | null;
      }[] = [];

      let productsCreated = 0;

      for (const item of input.items) {
        let productId = item.suggestedProductId;

        // If no matched product, auto-create a draft product
        if (!productId) {
          const sku = item.skuHint
            ? item.skuHint.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase() || `AI-${shortId()}`
            : `AI-${shortId()}`;

          const [newProduct] = await ctx.db
            .insert(Product)
            .values({
              sku,
              name: item.translatedName || item.originalName,
              descriptionShort: item.originalName !== item.translatedName
                ? `Original: ${item.originalName}`
                : null,
              imageUrl: item.imageUrl ?? null,
              weight: item.weightKg ?? undefined,
              costAvg: item.unitCost ?? 0,
              status: "draft",
            })
            .returning({ id: Product.id });

          productId = newProduct?.id ?? null;
          productsCreated++;
        }

        containerItemRows.push({
          containerId: input.containerId,
          productId,
          quantityExpected: item.quantity,
          unitCost: item.unitCost,
          notes: [
            item.originalName !== item.translatedName ? `Original: ${item.originalName}` : null,
            item.categoryHint ? `Categoría: ${item.categoryHint}` : null,
            item.imageDescription ? `Imagen: ${item.imageDescription}` : null,
            `Confianza: ${item.confidence}% | Match: ${item.matchType}`,
          ].filter(Boolean).join(" · "),
        });
      }

      // Batch insert all container items
      if (containerItemRows.length > 0) {
        await ctx.db.insert(ContainerItem).values(containerItemRows);
      }

      await logAudit(ctx.db, ctx.user, {
        action: "container.confirm_ai_import",
        entity: "container",
        entityId: input.containerId,
        newValue: {
          totalItems: input.items.length,
          productsCreated,
          matched: input.items.filter((i) => i.suggestedProductId).length,
        },
      });

      return {
        success: true,
        itemsImported: containerItemRows.length,
        productsCreated,
      };
    }),
});
