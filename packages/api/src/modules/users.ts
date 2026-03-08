/**
 * Cendaro — Users Router
 *
 * CRUD operations for user profiles. Admin-only for write operations.
 * Reads allowed for supervisors+.
 */
import { z } from "zod/v4";
import { desc, eq } from "drizzle-orm";

import { UserProfile, userRoleEnum, userStatusEnum } from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const usersRouter = createTRPCRouter({
  /** List all users (admin, owner, supervisor) */
  list: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(UserProfile)
        .orderBy(desc(UserProfile.createdAt));
    }),

  /** Get current user's profile */
  me: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1);
    return profile ?? null;
  }),

  /** Get user by ID (admin, owner) */
  byId: roleRestrictedProcedure(["owner", "admin"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select()
        .from(UserProfile)
        .where(eq(UserProfile.id, input.id))
        .limit(1);
      return profile ?? null;
    }),

  /** Create user profile (admin, owner) */
  create: roleRestrictedProcedure(["owner", "admin"])
    .input(
      z.object({
        id: z.string().uuid(),
        email: z.email(),
        fullName: z.string().min(1).max(256),
        role: z.enum(userRoleEnum.enumValues),
        phone: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(UserProfile)
        .values({
          id: input.id,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          phone: input.phone,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "user.create",
        entity: "user_profile",
        entityId: input.id,
        newValue: { email: input.email, role: input.role },
      });

      return created;
    }),

  /** Update user profile (admin, owner) */
  update: roleRestrictedProcedure(["owner", "admin"])
    .input(
      z.object({
        id: z.string().uuid(),
        fullName: z.string().min(1).max(256).optional(),
        role: z.enum(userRoleEnum.enumValues).optional(),
        status: z.enum(userStatusEnum.enumValues).optional(),
        phone: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Get old values for audit trail
      const [oldProfile] = await ctx.db
        .select()
        .from(UserProfile)
        .where(eq(UserProfile.id, id))
        .limit(1);

      const [updated] = await ctx.db
        .update(UserProfile)
        .set(updates)
        .where(eq(UserProfile.id, id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "user.update",
        entity: "user_profile",
        entityId: id,
        oldValue: oldProfile ? { role: oldProfile.role, status: oldProfile.status } : null,
        newValue: updates,
      });

      return updated;
    }),
});
