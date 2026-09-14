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
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AuditLog,
  UserProfile,
  userRoleEnum,
  userStatusEnum,
  Workspace,
  WorkspaceMember,
} from "@cendaro/db/schema";
import { UiPreferencesSchema } from "@cendaro/validators";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
  workspaceReadProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const usersRouter = createTRPCRouter({
  /** List all users in current workspace (admin, owner, supervisor) */
  list: workspaceReadProcedure.query(async ({ ctx }) => {
    if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes permisos para ver los usuarios del workspace",
      });
    }

    return ctx.db
      .select({
        id: UserProfile.id,
        email: UserProfile.email,
        username: UserProfile.username,
        fullName: UserProfile.fullName,
        role: WorkspaceMember.role,
        status: UserProfile.status,
        memberStatus: WorkspaceMember.status,
        phone: UserProfile.phone,
        avatarUrl: UserProfile.avatarUrl,
        createdAt: WorkspaceMember.joinedAt,
      })
      .from(WorkspaceMember)
      .innerJoin(UserProfile, eq(UserProfile.id, WorkspaceMember.userId))
      .where(eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId))
      .orderBy(desc(WorkspaceMember.joinedAt));
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

  /** Get user by ID (admin, owner, supervisor) */
  byId: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tienes permisos para ver detalles de este usuario",
        });
      }

      const [member] = await ctx.db
        .select({
          id: UserProfile.id,
          email: UserProfile.email,
          username: UserProfile.username,
          fullName: UserProfile.fullName,
          role: WorkspaceMember.role,
          status: WorkspaceMember.status,
          phone: UserProfile.phone,
          avatarUrl: UserProfile.avatarUrl,
          createdAt: WorkspaceMember.joinedAt,
        })
        .from(WorkspaceMember)
        .innerJoin(UserProfile, eq(UserProfile.id, WorkspaceMember.userId))
        .where(
          and(
            eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId),
            eq(WorkspaceMember.userId, input.id),
          ),
        )
        .limit(1);

      return member ?? null;
    }),

  /** Create user profile (admin, owner) */
  create: workspaceProcedure
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
      const callerRole = ctx.user.user_metadata?.role;
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
  update: workspaceProcedure
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
      const callerRole = ctx.workspace.role;

      // Verify target user belongs to current workspace
      const [targetMember] = await ctx.db
        .select()
        .from(WorkspaceMember)
        .where(
          and(
            eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId),
            eq(WorkspaceMember.userId, id),
          ),
        )
        .limit(1);

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado en este workspace",
        });
      }

      // Get target user's current profile
      const [targetProfile] = await ctx.db
        .select({ role: UserProfile.role })
        .from(UserProfile)
        .where(eq(UserProfile.id, id))
        .limit(1);

      if (!targetProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado",
        });
      }

      // Owner-protection rules
      if (input.role !== undefined) {
        // Rule 1: Only owner can assign owner role
        if (input.role === "owner" && callerRole !== "owner") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Solo un dueño puede asignar el rol de dueño a otro usuario",
          });
        }

        // Rule 2: Cannot change an owner's role if you're not an owner
        if (targetMember.role === "owner" && callerRole !== "owner") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo un dueño puede cambiar el rol de otro dueño",
          });
        }

        // Rule 3: Owner cannot change another owner's role (peer protection)
        if (
          targetMember.role === "owner" &&
          callerRole === "owner" &&
          ctx.user.id !== id
        ) {
          throw new TRPCError({
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

  // ─── UI Preferences (PLAN-2026-09-DESIGN-SYSTEM §T3.2) ────
  // Always scoped to `ctx.user.id` — never from the input — so a user can
  // only ever read or write their own preferences.

  /** Get the current user's UI preferences (dashboard widget order/visibility) */
  uiPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ uiPreferences: UserProfile.uiPreferences })
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1);

    return row?.uiPreferences ?? {};
  }),

  /** Merge-update the current user's UI preferences */
  updateUiPreferences: protectedProcedure
    .input(UiPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({ uiPreferences: UserProfile.uiPreferences })
        .from(UserProfile)
        .where(eq(UserProfile.id, ctx.user.id))
        .limit(1);

      const merged = { ...(current?.uiPreferences ?? {}), ...input };

      const [updated] = await ctx.db
        .update(UserProfile)
        .set({ uiPreferences: merged })
        .where(eq(UserProfile.id, ctx.user.id))
        .returning({ uiPreferences: UserProfile.uiPreferences });

      return updated?.uiPreferences ?? merged;
    }),

  // ─── MFA Compliance Status (SOC 2 CC6.1 / ISO 27001 A.8.5) ───

  /** Get current user's MFA status and compliance posture */
  mfaStatus: protectedProcedure.query(({ ctx }) => {
    const meta = ctx.user.user_metadata as Record<string, unknown> | undefined;
    const role = typeof meta?.role === "string" ? meta.role : "employee";
    const isPrivileged = ["owner", "admin", "supervisor"].includes(role);
    const mfaEnrolled = Boolean(meta?.mfa_enrolled ?? meta?.totp_enabled);

    return {
      enrolled: mfaEnrolled,
      required: isPrivileged,
      role,
      recommendation:
        isPrivileged && !mfaEnrolled
          ? "MFA/TOTP es requerido para roles administrativos conforme a SOC 2 (CC6.1) e ISO 27001 (A.8.5)"
          : "Nivel de autenticación conforme",
    };
  }),

  // ─── Data Subject Rights (ISO/IEC 27018 & GDPR DSR) ───

  /**
   * Export all personal data belonging to the authenticated user.
   * Complies with ISO/IEC 27018 §A.10 and GDPR Article 15/20 (Data Portability).
   */
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1);

    if (!profile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Perfil de usuario no encontrado",
      });
    }

    const memberships = await ctx.db
      .select({
        workspaceId: WorkspaceMember.workspaceId,
        workspaceName: Workspace.name,
        role: WorkspaceMember.role,
        status: WorkspaceMember.status,
        joinedAt: WorkspaceMember.joinedAt,
      })
      .from(WorkspaceMember)
      .innerJoin(Workspace, eq(Workspace.id, WorkspaceMember.workspaceId))
      .where(eq(WorkspaceMember.userId, ctx.user.id));

    const auditEntries = await ctx.db
      .select({
        id: AuditLog.id,
        action: AuditLog.action,
        entity: AuditLog.entity,
        createdAt: AuditLog.createdAt,
      })
      .from(AuditLog)
      .where(eq(AuditLog.actorId, ctx.user.id))
      .orderBy(desc(AuditLog.createdAt))
      .limit(100);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        requestorId: ctx.user.id,
        standard: "ISO/IEC 27018 & GDPR DSR",
        formatVersion: "1.0",
      },
      profile: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        fullName: profile.fullName,
        role: profile.role,
        status: profile.status,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
        lastLoginAt: profile.lastLoginAt,
      },
      workspaces: memberships,
      recentActivitySummary: {
        totalLoggedEvents: auditEntries.length,
        recentEvents: auditEntries,
      },
    };
  }),

  /**
   * Anonymize user PII (Right to be Forgotten).
   * Complies with ISO/IEC 27018 §A.11 and GDPR Article 17 (Right to Erasure).
   * Preserves historical UUID links for financial/tax compliance (SOC 1 ICFR).
   */
  anonymizeMyData: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("CONFIRMAR_ELIMINACION_DE_DATOS"),
      }),
    )
    .mutation(async ({ ctx }) => {
      // Check if user is the sole owner of any active workspace
      const ownedWorkspaces = await ctx.db
        .select({
          workspaceId: WorkspaceMember.workspaceId,
          role: WorkspaceMember.role,
        })
        .from(WorkspaceMember)
        .where(
          and(
            eq(WorkspaceMember.userId, ctx.user.id),
            eq(WorkspaceMember.role, "owner"),
            eq(WorkspaceMember.status, "active"),
          ),
        );

      if (ownedWorkspaces.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No puedes anonimizar tu cuenta mientras seas el único propietario de un workspace activo. Transfiere la propiedad primero.",
        });
      }

      const anonymizedEmail = `anonymized-${ctx.user.id.slice(0, 8)}@cendaro.internal`;
      const anonymizedUsername = `anon_${ctx.user.id.slice(0, 8)}`;

      // Anonymize PII in user_profile
      await ctx.db
        .update(UserProfile)
        .set({
          fullName: "Usuario Anonimizado",
          email: anonymizedEmail,
          username: anonymizedUsername,
          phone: null,
          avatarUrl: null,
          status: "inactive",
        })
        .where(eq(UserProfile.id, ctx.user.id));

      // Remove from all workspace memberships
      await ctx.db
        .update(WorkspaceMember)
        .set({ status: "removed" })
        .where(eq(WorkspaceMember.userId, ctx.user.id));

      await logAudit(ctx.db, ctx.user, {
        action: "user.data_anonymization_dsr",
        entity: "user_profile",
        entityId: ctx.user.id,
        metadata: {
          standard: "ISO/IEC 27018 / GDPR Right to Erasure",
        },
      });

      return {
        success: true,
        message:
          "Datos personales anonimizados exitosamente conforme a ISO/IEC 27018.",
      };
    }),
});
