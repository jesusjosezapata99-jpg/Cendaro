/**
 * Cendaro — Workspace Router
 *
 * CRUD operations for workspaces, member management, and module listing.
 * Used by the workspace switcher and settings pages.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { memberStatusEnum } from "@cendaro/db/schema";
import {
  UserProfile,
  Workspace,
  WorkspaceMember,
  WorkspaceModule,
  WorkspaceQuota,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "../trpc";

// ── Plan defaults (sync with erpModuleEnum in schema.ts) ──────────
// Exact enum values: dashboard, catalog, inventory, containers, pricing, rates,
// pos, orders, customers, vendors, payments, cash_closure, marketplace, whatsapp,
// users, audit, settings

const STARTER_MODULES = [
  "dashboard",
  "catalog",
  "inventory",
  "orders",
  "pos",
  "customers",
] as const;

const PRO_MODULES = [
  "dashboard",
  "catalog",
  "inventory",
  "containers",
  "pricing",
  "rates",
  "pos",
  "orders",
  "customers",
  "vendors",
  "payments",
  "cash_closure",
  "marketplace",
  "whatsapp",
  "users",
  "audit",
  "settings",
] as const;

const PLAN_MODULES = {
  starter: STARTER_MODULES,
  pro: PRO_MODULES,
  enterprise: PRO_MODULES, // enterprise gets same modules + custom
} as const;

const PLAN_QUOTAS = {
  starter: {
    maxUsers: 1,
    maxWarehouses: 1,
    maxProducts: 500,
    maxCustomers: 50,
    maxStorageMb: 500,
  },
  pro: {
    maxUsers: -1, // unlimited
    maxWarehouses: -1,
    maxProducts: -1,
    maxCustomers: -1,
    maxStorageMb: 10240, // 10 GB
  },
  enterprise: {
    maxUsers: -1,
    maxWarehouses: -1,
    maxProducts: -1,
    maxCustomers: -1,
    maxStorageMb: -1,
  },
} as const;

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
  list: protectedProcedure.query(async ({ ctx }) => {
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
  current: workspaceProcedure.query(async ({ ctx }) => {
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
   * Create a new workspace.
   * Runs as postgres (no workspace context).
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(128),
        plan: z.enum(["starter", "pro", "enterprise"]).default("starter"),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      // Check slug uniqueness
      const [existing] = await ctx.db
        .select({ id: Workspace.id })
        .from(Workspace)
        .where(eq(Workspace.slug, slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe un workspace con ese nombre",
        });
      }

      // Create workspace
      const [workspace] = await ctx.db
        .insert(Workspace)
        .values({
          name: input.name,
          slug,
          plan: input.plan,
          organizationId: input.organizationId,
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

      // Add creator as owner member
      await ctx.db.insert(WorkspaceMember).values({
        workspaceId: workspace.id,
        userId: ctx.user.id,
        role: "owner",
        status: "active",
      });

      // Setup modules for plan
      const planModules = PLAN_MODULES[input.plan];
      for (const mod of planModules) {
        await ctx.db.insert(WorkspaceModule).values({
          workspaceId: workspace.id,
          module: mod,
        });
      }

      // Setup quota for plan
      const quotas = PLAN_QUOTAS[input.plan];
      await ctx.db.insert(WorkspaceQuota).values({
        workspaceId: workspace.id,
        ...quotas,
      });

      return workspace;
    }),

  /**
   * Update workspace settings (name only — no logoUrl in schema).
   * Requires workspace context.
   */
  update: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(2).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

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

      return updated;
    }),

  /**
   * List workspace members with profile info.
   */
  members: workspaceProcedure.query(async ({ ctx }) => {
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
      .where(eq(WorkspaceMember.workspaceId, ws.workspaceId))
      .orderBy(desc(WorkspaceMember.joinedAt));

    return rows;
  }),

  /**
   * Invite a new member to the workspace.
   */
  inviteMember: workspaceProcedure
    .input(
      z.object({
        email: z.email(),
        role: z.enum(["admin", "supervisor", "employee", "marketing"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

      // Find user by email
      const [user] = await ctx.db
        .select({ id: UserProfile.id })
        .from(UserProfile)
        .where(eq(UserProfile.email, input.email))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado. Debe registrarse primero.",
        });
      }

      // Check if already a member
      const [existing] = await ctx.db
        .select({ id: WorkspaceMember.id })
        .from(WorkspaceMember)
        .where(
          and(
            eq(WorkspaceMember.workspaceId, ws.workspaceId),
            eq(WorkspaceMember.userId, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El usuario ya es miembro de este workspace",
        });
      }

      const [member] = await ctx.db
        .insert(WorkspaceMember)
        .values({
          workspaceId: ws.workspaceId,
          userId: user.id,
          role: input.role,
          status: "active",
        })
        .returning();

      return member;
    }),

  /**
   * Remove a member from the workspace.
   */
  removeMember: workspaceProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ws = ctx.workspace;

      // Can't remove yourself
      if (input.memberId === ws.memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No puedes eliminarte a ti mismo",
        });
      }

      const [updated] = await ctx.db
        .update(WorkspaceMember)
        .set({
          status: "removed" as (typeof memberStatusEnum.enumValues)[number],
        })
        .where(
          and(
            eq(WorkspaceMember.id, input.memberId),
            eq(WorkspaceMember.workspaceId, ws.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Miembro no encontrado",
        });
      }

      return { success: true };
    }),
});
