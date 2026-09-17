/**
 * Cendaro — Users Router
 *
 * Profile reads and updates. Account creation lives in
 * `POST /api/auth/create-user` (auth user + profile + workspace membership
 * created atomically with the service role), not in this router.
 * Reads allowed for supervisors+.
 *
 * Update rules (roles are per workspace: `workspace_member.role` is what the
 * server authorizes with; `user_profile.role` is kept in sync for display):
 *  - Only owner/admin can update members
 *  - Nobody changes their own role
 *  - Only owner can assign "owner" or "admin"
 *  - Only owner can modify an owner or an admin
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
  invalidateUserAuthzCache,
  memberReadProcedure,
  selfProcedure,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const usersRouter = createTRPCRouter({
  /** List all users in current workspace (admin, owner, supervisor) */
  list: wsReadPermissionProcedure("users", "read").query(async ({ ctx }) => {
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
  me: selfProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1);
    return profile ?? null;
  }),

  /** Get user by ID (admin, owner, supervisor) */
  byId: wsPermissionProcedure("users", "read")
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

  /** Update a workspace member (owner, admin) — see the rules in the header */
  update: wsPermissionProcedure("users", "update")
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
      const { id, role, ...profileUpdates } = input;
      const callerRole = ctx.workspace.role;
      const isCallerOwner = callerRole === "owner";

      if (callerRole !== "owner" && callerRole !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo propietarios o administradores pueden editar usuarios",
        });
      }

      const [targetMember] = await ctx.db
        .select({ role: WorkspaceMember.role })
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

      const isTargetPrivileged =
        targetMember.role === "owner" || targetMember.role === "admin";
      if (isTargetPrivileged && !isCallerOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo un dueño puede modificar a un dueño o administrador",
        });
      }

      const roleChanges = role !== undefined && role !== targetMember.role;
      if (roleChanges) {
        if (ctx.user.id === id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No puedes cambiar tu propio rol",
          });
        }
        if ((role === "owner" || role === "admin") && !isCallerOwner) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Solo un dueño puede asignar el rol de dueño o administrador",
          });
        }
        if (targetMember.role === "owner") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No puedes cambiar el rol de otro dueño",
          });
        }
      }

      const [oldProfile] = await ctx.db
        .select({ status: UserProfile.status })
        .from(UserProfile)
        .where(eq(UserProfile.id, id))
        .limit(1);

      if (roleChanges) {
        await ctx.db
          .update(WorkspaceMember)
          .set({ role })
          .where(
            and(
              eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId),
              eq(WorkspaceMember.userId, id),
            ),
          );
      }

      const [updated] = await ctx.db
        .update(UserProfile)
        .set(roleChanges ? { ...profileUpdates, role } : profileUpdates)
        .where(eq(UserProfile.id, id))
        .returning();

      if (roleChanges || profileUpdates.status !== undefined) {
        invalidateUserAuthzCache(id);
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "user.update",
        entity: "user_profile",
        entityId: id,
        oldValue: {
          memberRole: targetMember.role,
          status: oldProfile?.status ?? null,
        },
        newValue: roleChanges ? { ...profileUpdates, role } : profileUpdates,
      });

      return updated;
    }),

  // ─── UI Preferences (PLAN-2026-09-DESIGN-SYSTEM §T3.2) ────
  // Always scoped to `ctx.user.id` — never from the input — so a user can
  // only ever read or write their own preferences.

  /** Get the current user's UI preferences (dashboard widget order/visibility) */
  uiPreferences: selfProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ uiPreferences: UserProfile.uiPreferences })
      .from(UserProfile)
      .where(eq(UserProfile.id, ctx.user.id))
      .limit(1);

    return row?.uiPreferences ?? {};
  }),

  /** Merge-update the current user's UI preferences */
  updateUiPreferences: selfProcedure
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

  /**
   * Current session's MFA posture. `enrolled` means this session is verified
   * with a second factor (JWT `aal2`); the role is the DB workspace role.
   */
  mfaStatus: memberReadProcedure.query(({ ctx }) => {
    const role = ctx.workspace.role;
    const isPrivileged = ["owner", "admin", "supervisor"].includes(role);
    const mfaEnrolled = ctx.user.aal === "aal2";

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
  exportMyData: selfProcedure.query(async ({ ctx }) => {
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
  anonymizeMyData: selfProcedure
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
