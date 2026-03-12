/**
 * Cendaro — Users Router
 *
 * CRUD operations for user profiles. Admin-only for write operations.
 * Reads allowed for supervisors+.
 *
 * Owner-protection rules:
 *  - Only owner can assign the "owner" role
 *  - Only owner can demote another owner
 *  - Owner cannot change another owner's role (peer protection)
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { UserProfile, userRoleEnum, userStatusEnum } from "@cendaro/db/schema";

import type { UserMeta } from "../trpc";
import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const usersRouter = createTRPCRouter({
  /** List all users (admin, owner, supervisor) */
  list: roleRestrictedProcedure(["owner", "admin", "supervisor"]).query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: UserProfile.id,
          email: UserProfile.email,
          username: UserProfile.username,
          fullName: UserProfile.fullName,
          role: UserProfile.role,
          status: UserProfile.status,
          phone: UserProfile.phone,
          avatarUrl: UserProfile.avatarUrl,
          createdAt: UserProfile.createdAt,
        })
        .from(UserProfile)
        .orderBy(desc(UserProfile.createdAt));
    },
  ),

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
        username: z.string().min(3).max(128),
        fullName: z.string().min(1).max(256),
        role: z.enum(userRoleEnum.enumValues),
        phone: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Owner-protection: only owner can create another owner
      const callerRole = (ctx.user.user_metadata as UserMeta | undefined)?.role;
      if (input.role === "owner" && callerRole !== "owner") {
        throw new (await import("@trpc/server")).TRPCError({
          code: "FORBIDDEN",
          message: "Solo un dueño puede asignar el rol de dueño a otro usuario",
        });
      }

      const [created] = await ctx.db
        .insert(UserProfile)
        .values({
          id: input.id,
          email: input.email,
          username: input.username,
          fullName: input.fullName,
          role: input.role,
          phone: input.phone,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "user.create",
        entity: "user_profile",
        entityId: input.id,
        newValue: {
          email: input.email,
          username: input.username,
          role: input.role,
        },
      });

      return created;
    }),

  /** Update user profile (admin, owner) with owner-protection */
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
      const callerRole = (ctx.user.user_metadata as UserMeta | undefined)?.role;

      // Get target user's current profile
      const [targetProfile] = await ctx.db
        .select({ role: UserProfile.role })
        .from(UserProfile)
        .where(eq(UserProfile.id, id))
        .limit(1);

      if (!targetProfile) {
        throw new (await import("@trpc/server")).TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado",
        });
      }

      // Owner-protection rules
      if (input.role !== undefined) {
        // Rule 1: Only owner can assign owner role
        if (input.role === "owner" && callerRole !== "owner") {
          throw new (await import("@trpc/server")).TRPCError({
            code: "FORBIDDEN",
            message:
              "Solo un dueño puede asignar el rol de dueño a otro usuario",
          });
        }

        // Rule 2: Cannot change an owner's role if you're not an owner
        if (targetProfile.role === "owner" && callerRole !== "owner") {
          throw new (await import("@trpc/server")).TRPCError({
            code: "FORBIDDEN",
            message: "Solo un dueño puede cambiar el rol de otro dueño",
          });
        }

        // Rule 3: Owner cannot change another owner's role (peer protection)
        if (
          targetProfile.role === "owner" &&
          callerRole === "owner" &&
          ctx.user.id !== id
        ) {
          throw new (await import("@trpc/server")).TRPCError({
            code: "FORBIDDEN",
            message: "No puedes cambiar el rol de otro dueño",
          });
        }
      }

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
        oldValue: oldProfile
          ? { role: oldProfile.role, status: oldProfile.status }
          : null,
        newValue: updates,
      });

      return updated;
    }),
});
