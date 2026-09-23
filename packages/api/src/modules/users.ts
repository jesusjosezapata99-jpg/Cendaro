/**
 * Cendaro — Users Router
 *
 * Profile reads and updates. Account creation lives in
 * `POST /api/auth/create-user` (auth user + profile + workspace membership
 * created atomically with the service role), not in this router.
 * Reads allowed for supervisors+.
 *
 * Update rules. Role and access status are per workspace — `workspace_member`
 * is what the server authorizes with (`is_workspace_member()` only admits
 * active members); `user_profile` is one global row shared by every workspace
 * the person belongs to, and its `role` is only a display mirror:
 *  - Only owner/admin can update members
 *  - Nobody changes their own role or their own access status
 *  - Only owner can assign "owner" or "admin"
 *  - Only owner can modify an owner or an admin
 *  - Owner cannot change another owner's role or suspend another owner
 *    (peer protection)
 *  - Pending invitations and removed memberships are not editable here
 *  - Reactivating a suspended member needs a free seat (max_users)
 *  - Name and phone change only for active members who belong to no other
 *    workspace (PLAN-2026-09-SECURITY-REMEDIATION F3.1)
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AuditLog,
  UserProfile,
  userRoleEnum,
  Workspace,
  WorkspaceMember,
} from "@cendaro/db/schema";
import { UiPreferencesSchema } from "@cendaro/validators";

import { revokeSessionsIfAccessLost } from "../services/auth-admin";
import { mfaComplianceFor } from "../services/mfa-enforcement";
import {
  createTRPCRouter,
  memberReadProcedure,
  selfProcedure,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import { assertSeatAvailable } from "./workspace-seats";

/**
 * Memberships with a real relationship to the workspace. Pending invitations
 * and removed members are never listed nor editable here: that would reveal
 * which invited emails have an account (inviteMember answers uniformly) and
 * expose the shared profile of people who never joined or already left.
 */
const LISTED_MEMBER_STATUSES: (typeof WorkspaceMember.$inferSelect)["status"][] =
  ["active", "suspended"];

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
        // Access to this workspace; the global profile status is not shown.
        status: WorkspaceMember.status,
        memberStatus: WorkspaceMember.status,
        phone: UserProfile.phone,
        avatarUrl: UserProfile.avatarUrl,
        createdAt: WorkspaceMember.joinedAt,
      })
      .from(WorkspaceMember)
      .innerJoin(UserProfile, eq(UserProfile.id, WorkspaceMember.userId))
      .where(
        and(
          eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId),
          inArray(WorkspaceMember.status, LISTED_MEMBER_STATUSES),
        ),
      )
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
            inArray(WorkspaceMember.status, LISTED_MEMBER_STATUSES),
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
        /** Access to this workspace (workspace_member.status). */
        status: z.enum(["active", "suspended"]).optional(),
        phone: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, role, status, fullName, phone } = input;
      const callerRole = ctx.workspace.role;
      const isCallerOwner = callerRole === "owner";
      const isSelf = ctx.user.id === id;

      if (callerRole !== "owner" && callerRole !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo propietarios o administradores pueden editar usuarios",
        });
      }

      const [targetMember] = await ctx.db
        .select({ role: WorkspaceMember.role, status: WorkspaceMember.status })
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

      // A pending invitation or a removed membership is no relationship with
      // this workspace: it is managed only through workspace.inviteMember /
      // acceptInvite / removeMember, never edited here.
      if (
        targetMember.status !== "active" &&
        targetMember.status !== "suspended"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Este usuario no tiene acceso a este workspace (invitación pendiente o removido)",
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
        if (isSelf) {
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

      const statusChanges =
        status !== undefined && status !== targetMember.status;
      if (statusChanges) {
        if (isSelf) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No puedes cambiar tu propio estado de acceso",
          });
        }
        // Suspending is effective removal (is_workspace_member() only admits
        // active members), and removeMember never removes an owner.
        if (targetMember.role === "owner") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No puedes suspender a otro dueño",
          });
        }
      }

      const profileUpdates = {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
      };
      const hasProfileUpdates = Object.keys(profileUpdates).length > 0;
      const isTargetActive = targetMember.status === "active";

      if (hasProfileUpdates && !isTargetActive) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Solo se pueden editar el nombre y el teléfono de un miembro activo",
        });
      }

      // The profile row is shared by every workspace of this person: only
      // edit it from here when nobody else depends on it.
      const mirrorsRole = roleChanges && isTargetActive;
      let sharedWithOtherWorkspaces = false;
      if (!isSelf && (hasProfileUpdates || mirrorsRole)) {
        const { rows } = await ctx.db.execute<{ memberships: number }>(
          sql`SELECT public.user_membership_count(${id}::uuid) AS memberships`,
        );
        sharedWithOtherWorkspaces = Number(rows[0]?.memberships ?? 0) > 1;
      }
      if (hasProfileUpdates && sharedWithOtherWorkspaces) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Este usuario también pertenece a otros workspaces: su nombre y teléfono no se pueden cambiar desde aquí",
        });
      }

      // Reactivation takes a seat again; the quota trigger only sees INSERTs.
      if (statusChanges && status === "active") {
        await assertSeatAvailable(ctx.db, ctx.workspace.workspaceId, [
          "active",
        ]);
      }

      const memberChanges = {
        ...(roleChanges ? { role } : {}),
        ...(statusChanges ? { status } : {}),
      };
      if (Object.keys(memberChanges).length > 0) {
        await ctx.db
          .update(WorkspaceMember)
          .set(memberChanges)
          .where(
            and(
              eq(WorkspaceMember.workspaceId, ctx.workspace.workspaceId),
              eq(WorkspaceMember.userId, id),
            ),
          );
      }

      const profileChanges = {
        ...profileUpdates,
        ...(mirrorsRole && !sharedWithOtherWorkspaces ? { role } : {}),
      };
      if (Object.keys(profileChanges).length > 0) {
        await ctx.db
          .update(UserProfile)
          .set(profileChanges)
          .where(eq(UserProfile.id, id));
      }

      // Losing access must end the open session too (F5.2): the membership
      // row alone would leave their refresh token minting access tokens.
      // Queued for after the commit, where it runs as `postgres` and sees the
      // new status.
      if (statusChanges && status === "suspended") {
        ctx.afterCommit.push((db) =>
          revokeSessionsIfAccessLost(db, id, { log: ctx.log }),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "user.update",
        entity: "workspace_member",
        entityId: id,
        oldValue: {
          memberRole: targetMember.role,
          memberStatus: targetMember.status,
        },
        newValue: { ...profileUpdates, ...memberChanges },
      });

      return { id, ...profileChanges, ...memberChanges };
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
   * `blocked`/`gracePeriodEndsAt` come from the same `mfaComplianceFor` that
   * gates mutations in `workspaceProcedure` (F7.2) — this display and that
   * enforcement can never disagree.
   */
  mfaStatus: memberReadProcedure.query(({ ctx }) => {
    const role = ctx.workspace.role;
    const compliance = mfaComplianceFor(role, ctx.user.aal);

    return {
      enrolled: compliance.enrolled,
      required: compliance.required,
      blocked: compliance.blocked,
      gracePeriodEndsAt: compliance.gracePeriodEndsAt,
      role,
      recommendation: compliance.blocked
        ? "MFA/TOTP es obligatorio para tu rol y aún no está activo: las acciones que modifican datos están bloqueadas hasta que lo actives."
        : compliance.required && !compliance.enrolled
          ? compliance.gracePeriodEndsAt
            ? `MFA/TOTP es requerido para roles administrativos conforme a SOC 2 (CC6.1) e ISO 27001 (A.8.5). Actívalo antes del ${compliance.gracePeriodEndsAt.toISOString().slice(0, 10)}.`
            : "MFA/TOTP es recomendado para roles administrativos conforme a SOC 2 (CC6.1) e ISO 27001 (A.8.5)."
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
