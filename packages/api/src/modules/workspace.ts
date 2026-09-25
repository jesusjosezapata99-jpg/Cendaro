/**
 * Cendaro — Workspace Router
 *
 * CRUD operations for workspaces, member management, and module listing.
 * Used by the workspace switcher and settings pages.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  UserProfile,
  Workspace,
  WorkspaceMember,
  WorkspaceModule,
  WorkspaceQuota,
} from "@cendaro/db/schema";
import { STARTER_MODULES, STARTER_QUOTA } from "@cendaro/validators";

import { revokeSessionsIfAccessLost } from "../services/auth-admin";
import {
  createTRPCRouter,
  memberReadProcedure,
  selfProcedure,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import { isUniqueViolation } from "./db-errors";
import { assertSeatAvailable } from "./workspace-seats";

type Db = Parameters<typeof logAudit>[0];
type MemberRow = typeof WorkspaceMember.$inferSelect;

/** Members with a real relationship to the workspace (listed, with profile). */
const LISTED_MEMBER_STATUSES: MemberRow["status"][] = ["active", "suspended"];

// ── New workspace defaults (sync with erpModuleEnum in schema.ts) ──
// A workspace is always created on the starter plan: plans only change
// through a server-side billing process (service_role), never from a client
// request (PLAN-2026-09-SECURITY-REMEDIATION F3.3, finding H3).
// Core modules (dashboard, users, settings, audit — CORE_MODULES in
// @cendaro/validators) are enabled for every plan regardless of these rows.
// STARTER_MODULES / STARTER_QUOTA live in @cendaro/validators (plans.ts):
// the public site publishes the same limits.

/** The caller's own pending invitation to a workspace, locked for update. */
async function findPendingInvitation(
  db: Db,
  userId: string,
  workspaceId: string,
): Promise<Pick<MemberRow, "id" | "role">> {
  const [invitation] = await db
    .select({ id: WorkspaceMember.id, role: WorkspaceMember.role })
    .from(WorkspaceMember)
    .where(
      and(
        eq(WorkspaceMember.workspaceId, workspaceId),
        eq(WorkspaceMember.userId, userId),
        eq(WorkspaceMember.status, "invited"),
      ),
    )
    .limit(1)
    .for("update");
  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitación no encontrada",
    });
  }
  return invitation;
}

function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Router ───────────────────────────────────────
export const workspaceRouter = createTRPCRouter({
  /**
   * List all workspaces the current user is a member of.
   * No workspace context needed — runs as postgres.
   */
  list: selfProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: Workspace.id,
        name: Workspace.name,
        slug: Workspace.slug,
        plan: Workspace.plan,
        status: Workspace.status,
        memberRole: WorkspaceMember.role,
      })
      .from(WorkspaceMember)
      .innerJoin(Workspace, eq(Workspace.id, WorkspaceMember.workspaceId))
      .where(
        and(
          eq(WorkspaceMember.userId, ctx.user.id),
          eq(WorkspaceMember.status, "active"),
        ),
      )
      .orderBy(desc(Workspace.createdAt));

    return rows;
  }),

  /**
   * Get current workspace details + modules + quota.
   * Requires workspace context (SET LOCAL already applied).
   */
  current: memberReadProcedure.query(async ({ ctx }) => {
    const ws = ctx.workspace;

    const [workspace] = await ctx.db
      .select()
      .from(Workspace)
      .where(eq(Workspace.id, ws.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace no encontrado",
      });
    }

    const modules = await ctx.db
      .select({
        module: WorkspaceModule.module,
      })
      .from(WorkspaceModule)
      .where(eq(WorkspaceModule.workspaceId, ws.workspaceId));

    const [quota] = await ctx.db
      .select()
      .from(WorkspaceQuota)
      .where(eq(WorkspaceQuota.workspaceId, ws.workspaceId))
      .limit(1);

    return {
      ...workspace,
      modules: modules.map((m) => m.module),
      quota,
    };
  }),

  /**
   * Create a new workspace in the caller's organization (F3.3, finding H3).
   * Runs as postgres (no workspace context) inside one transaction.
   *
   *  - Only an active owner of an active workspace in that organization may
   *    create one.
   *  - The organization always comes from the caller's profile; a different
   *    `organizationId` in the request is rejected.
   *  - The plan is always starter. Any `plan` sent by the client is ignored.
   */
  create: selfProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(128),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({ organizationId: UserProfile.organizationId })
        .from(UserProfile)
        .where(eq(UserProfile.id, ctx.user.id))
        .limit(1);
      const organizationId = profile?.organizationId ?? null;
      if (
        !organizationId ||
        (input.organizationId !== undefined &&
          input.organizationId !== organizationId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo puedes crear workspaces dentro de tu organización",
        });
      }

      const [ownership] = await ctx.db
        .select({ id: WorkspaceMember.id })
        .from(WorkspaceMember)
        .innerJoin(Workspace, eq(Workspace.id, WorkspaceMember.workspaceId))
        .where(
          and(
            eq(WorkspaceMember.userId, ctx.user.id),
            eq(WorkspaceMember.role, "owner"),
            eq(WorkspaceMember.status, "active"),
            eq(Workspace.organizationId, organizationId),
            eq(Workspace.status, "active"),
          ),
        )
        .limit(1);
      if (!ownership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo el propietario de un workspace de tu organización puede crear otro",
        });
      }

      const slug = generateSlug(input.name);
      if (!slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El nombre del workspace debe contener letras o números",
        });
      }

      const duplicateName = () =>
        new TRPCError({
          code: "CONFLICT",
          message: "Ya existe un workspace con ese nombre",
        });

      try {
        return await ctx.db.transaction(async (trx) => {
          const tx = trx as unknown as Db;

          const [existing] = await tx
            .select({ id: Workspace.id })
            .from(Workspace)
            .where(eq(Workspace.slug, slug))
            .limit(1);
          if (existing) throw duplicateName();

          const [workspace] = await tx
            .insert(Workspace)
            .values({
              name: input.name,
              slug,
              plan: "starter",
              organizationId,
              status: "active",
              createdBy: ctx.user.id,
            })
            .returning();
          if (!workspace) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Error al crear workspace",
            });
          }

          await tx.insert(WorkspaceMember).values({
            workspaceId: workspace.id,
            userId: ctx.user.id,
            role: "owner",
            status: "active",
          });

          await tx.insert(WorkspaceModule).values(
            STARTER_MODULES.map((module) => ({
              workspaceId: workspace.id,
              module,
            })),
          );

          await tx.insert(WorkspaceQuota).values({
            workspaceId: workspace.id,
            ...STARTER_QUOTA,
          });

          await logAudit(tx, ctx.user, {
            workspaceId: workspace.id,
            action: "workspace.create",
            entity: "workspace",
            entityId: workspace.id,
            newValue: {
              name: workspace.name,
              slug,
              plan: "starter",
              organizationId,
            },
          });

          return workspace;
        });
      } catch (error) {
        // uq_workspace_slug closes the race between the lookup and the insert.
        if (isUniqueViolation(error)) throw duplicateName();
        throw error;
      }
    }),

  /**
   * Update workspace settings (name only — no logoUrl in schema).
   * Requires workspace context.
   */
  update: wsPermissionProcedure("settings", "update")
    .input(
      z.object({
        name: z.string().min(2).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

      if (!["owner", "admin"].includes(ws.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo propietarios o administradores pueden editar el workspace",
        });
      }

      if (!input.name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No hay datos para actualizar",
        });
      }

      const [updated] = await ctx.db
        .update(Workspace)
        .set({
          name: input.name,
          slug: generateSlug(input.name),
        })
        .where(eq(Workspace.id, ws.workspaceId))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ws.workspaceId,
        action: "workspace.update",
        entity: "workspace",
        entityId: ws.workspaceId,
        newValue: { name: input.name },
      });

      return updated;
    }),

  /**
   * List workspace members with profile info.
   */
  members: wsReadPermissionProcedure("users", "read").query(async ({ ctx }) => {
    const ws = ctx.workspace;

    const rows = await ctx.db
      .select({
        memberId: WorkspaceMember.id,
        userId: WorkspaceMember.userId,
        role: WorkspaceMember.role,
        status: WorkspaceMember.status,
        joinedAt: WorkspaceMember.joinedAt,
        fullName: UserProfile.fullName,
        email: UserProfile.email,
        avatarUrl: UserProfile.avatarUrl,
      })
      .from(WorkspaceMember)
      .leftJoin(UserProfile, eq(UserProfile.id, WorkspaceMember.userId))
      // Pending invitations and removed members are not listed: showing them
      // would reveal which invited emails have an account and expose the
      // profile of people with no current relationship to the workspace.
      .where(
        and(
          eq(WorkspaceMember.workspaceId, ws.workspaceId),
          inArray(WorkspaceMember.status, LISTED_MEMBER_STATUSES),
        ),
      )
      .orderBy(desc(WorkspaceMember.joinedAt));

    return rows;
  }),

  /**
   * Invite an existing account to the workspace (F3.4, finding M7).
   *
   * The invitation stays `invited` — no access — until the invitee accepts
   * it with `acceptInvite`. The answer and the audit entry are identical
   * whether or not the email belongs to an account, or the account already
   * belongs to the workspace, so the endpoint cannot be used to discover
   * registered emails. Pending invitations count against max_users.
   */
  inviteMember: wsPermissionProcedure("users", "create")
    .input(
      z.object({
        email: z.email().transform((email) => email.toLowerCase()),
        role: z.enum(["admin", "supervisor", "employee", "marketing"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

      if (!["owner", "admin"].includes(ws.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo propietarios o administradores pueden invitar miembros",
        });
      }

      if (input.role === "admin" && ws.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el propietario puede invitar administradores",
        });
      }

      // Checked before the lookup so the outcome never depends on the email.
      await assertSeatAvailable(ctx.db, ws.workspaceId, ["active", "invited"]);

      // user_profile is only visible to app_user for members of this
      // workspace (migration 016); invitees are found through a definer
      // function that returns nothing but the id of an active account.
      const { rows } = await ctx.db.execute<{ user_id: string | null }>(
        sql`SELECT public.find_active_user_id_by_email(${input.email}) AS user_id`,
      );
      const inviteeId = rows[0]?.user_id ?? null;

      if (inviteeId) {
        const [existing] = await ctx.db
          .select({ id: WorkspaceMember.id, status: WorkspaceMember.status })
          .from(WorkspaceMember)
          .where(
            and(
              eq(WorkspaceMember.workspaceId, ws.workspaceId),
              eq(WorkspaceMember.userId, inviteeId),
            ),
          )
          .limit(1);

        if (!existing) {
          // A concurrent invitation of the same account must not surface as
          // an error: that difference would reveal the email is registered.
          await ctx.db
            .insert(WorkspaceMember)
            .values({
              workspaceId: ws.workspaceId,
              userId: inviteeId,
              role: input.role,
              status: "invited",
              invitedBy: ctx.user.id,
            })
            .onConflictDoNothing({
              target: [WorkspaceMember.workspaceId, WorkspaceMember.userId],
            });
        } else if (existing.status === "removed") {
          await ctx.db
            .update(WorkspaceMember)
            .set({
              role: input.role,
              status: "invited",
              invitedBy: ctx.user.id,
              // joinedAt doubles as the invitation date until acceptance.
              joinedAt: new Date(),
            })
            .where(
              and(
                eq(WorkspaceMember.id, existing.id),
                eq(WorkspaceMember.workspaceId, ws.workspaceId),
              ),
            );
        }
        // Active, suspended or already invited: nothing changes.
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ws.workspaceId,
        action: "workspace.invite_member",
        entity: "workspace_member",
        newValue: { email: input.email, role: input.role },
      });

      return { ok: true as const };
    }),

  /** Pending invitations addressed to the current user. */
  invitations: selfProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        workspaceId: Workspace.id,
        workspaceName: Workspace.name,
        role: WorkspaceMember.role,
        invitedAt: WorkspaceMember.joinedAt,
      })
      .from(WorkspaceMember)
      .innerJoin(Workspace, eq(Workspace.id, WorkspaceMember.workspaceId))
      .where(
        and(
          eq(WorkspaceMember.userId, ctx.user.id),
          eq(WorkspaceMember.status, "invited"),
          eq(Workspace.status, "active"),
        ),
      )
      .orderBy(desc(WorkspaceMember.joinedAt));
  }),

  /**
   * Accept the current user's own pending invitation. Runs as postgres in one
   * transaction: the invitation and the quota row are locked, and the seat is
   * re-checked because the quota trigger does not fire on this UPDATE.
   */
  acceptInvite: selfProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (trx) => {
        const tx = trx as unknown as Db;
        const invitation = await findPendingInvitation(
          tx,
          ctx.user.id,
          input.workspaceId,
        );

        const [workspace] = await tx
          .select({ status: Workspace.status })
          .from(Workspace)
          .where(eq(Workspace.id, input.workspaceId))
          .limit(1);
        if (workspace?.status !== "active") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitación no encontrada",
          });
        }

        await assertSeatAvailable(tx, input.workspaceId, ["active"]);

        await tx
          .update(WorkspaceMember)
          .set({ status: "active", joinedAt: new Date() })
          .where(
            and(
              eq(WorkspaceMember.id, invitation.id),
              eq(WorkspaceMember.workspaceId, input.workspaceId),
            ),
          );

        await logAudit(tx, ctx.user, {
          workspaceId: input.workspaceId,
          action: "workspace.accept_invite",
          entity: "workspace_member",
          entityId: invitation.id,
          newValue: { role: invitation.role },
        });
      });

      return { ok: true as const };
    }),

  /** Decline the current user's own pending invitation. */
  declineInvite: selfProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (trx) => {
        const tx = trx as unknown as Db;
        const invitation = await findPendingInvitation(
          tx,
          ctx.user.id,
          input.workspaceId,
        );

        await tx
          .update(WorkspaceMember)
          .set({ status: "removed" })
          .where(
            and(
              eq(WorkspaceMember.id, invitation.id),
              eq(WorkspaceMember.workspaceId, input.workspaceId),
            ),
          );

        await logAudit(tx, ctx.user, {
          workspaceId: input.workspaceId,
          action: "workspace.decline_invite",
          entity: "workspace_member",
          entityId: invitation.id,
        });
      });

      return { ok: true as const };
    }),

  /**
   * Remove a member from the workspace.
   */
  removeMember: wsPermissionProcedure("users", "delete")
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

      if (!["owner", "admin"].includes(ws.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo propietarios o administradores pueden eliminar miembros",
        });
      }

      // Can't remove yourself
      if (input.memberId === ws.memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No puedes eliminarte a ti mismo",
        });
      }

      const [target] = await ctx.db
        .select()
        .from(WorkspaceMember)
        .where(
          and(
            eq(WorkspaceMember.id, input.memberId),
            eq(WorkspaceMember.workspaceId, ws.workspaceId),
          ),
        )
        .limit(1);

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Miembro no encontrado",
        });
      }

      if (target.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No se puede eliminar al propietario del workspace",
        });
      }

      if (target.role === "admin" && ws.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el propietario puede eliminar administradores",
        });
      }

      await ctx.db
        .update(WorkspaceMember)
        .set({
          status: "removed",
        })
        .where(
          and(
            eq(WorkspaceMember.id, input.memberId),
            eq(WorkspaceMember.workspaceId, ws.workspaceId),
          ),
        )
        .returning();

      // A removed member keeps a working session until their tokens are
      // revoked (F5.2); queued for after the commit, where it runs as
      // `postgres` and sees the membership already removed.
      ctx.afterCommit.push((db) =>
        revokeSessionsIfAccessLost(db, target.userId, { log: ctx.log }),
      );

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ws.workspaceId,
        action: "workspace.remove_member",
        entity: "workspace_member",
        entityId: input.memberId,
        oldValue: { userId: target.userId, role: target.role },
      });

      return { success: true };
    }),
});
