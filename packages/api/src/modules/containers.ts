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
  containerStatusEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

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
});
