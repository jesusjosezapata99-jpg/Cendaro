/**
 * Cendaro — Approvals Router
 *
 * PRD §23: Approval workflow for price changes, container close, cash closure, etc.
 * @see docs/architecture/module_api_blueprint_v1.md — Audit & Approvals
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { Approval, approvalTypeEnum, Signature } from "@cendaro/db/schema";

import { createTRPCRouter, wsPermissionProcedure } from "../trpc";
import { logAudit } from "./audit";

export const approvalsRouter = createTRPCRouter({
  // ─── List pending approvals ───────────────────
  listPending: wsPermissionProcedure("dashboard", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: Approval.id,
          approvalType: Approval.approvalType,
          status: Approval.status,
          entityType: Approval.entityType,
          entityId: Approval.entityId,
          requestedBy: Approval.requestedBy,
          requestedAt: Approval.requestedAt,
          reason: Approval.reason,
          expiresAt: Approval.expiresAt,
        })
        .from(Approval)
        .where(
          and(
            eq(Approval.status, "pending"),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .orderBy(desc(Approval.requestedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── List all approvals ───────────────────────
  list: wsPermissionProcedure("dashboard", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        type: z.enum(approvalTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Approval.workspaceId, ctx.workspace.workspaceId)];

      if (input.type) {
        conditions.push(eq(Approval.approvalType, input.type));
      }

      return ctx.db
        .select({
          id: Approval.id,
          approvalType: Approval.approvalType,
          status: Approval.status,
          entityType: Approval.entityType,
          entityId: Approval.entityId,
          requestedBy: Approval.requestedBy,
          requestedAt: Approval.requestedAt,
          resolvedBy: Approval.resolvedBy,
          resolvedAt: Approval.resolvedAt,
          reason: Approval.reason,
        })
        .from(Approval)
        .where(and(...conditions))
        .orderBy(desc(Approval.requestedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get approval by ID with signatures ───────
  byId: wsPermissionProcedure("dashboard", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [approval] = await ctx.db
        .select()
        .from(Approval)
        .where(
          and(
            eq(Approval.id, input.id),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!approval) return null;

      const signatures = await ctx.db
        .select()
        .from(Signature)
        .where(
          and(
            eq(Signature.approvalId, input.id),
            eq(Signature.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      return { ...approval, signatures };
    }),

  // ─── Request approval ─────────────────────────
  // entityType/entityId are not verified against the workspace, so only
  // management may open requests (no ERP screen calls this yet).
  request: wsPermissionProcedure("dashboard", "update")
    .input(
      z.object({
        approvalType: z.enum(approvalTypeEnum.enumValues),
        entityType: z.string().min(1).max(64),
        entityId: z.string().uuid(),
        reason: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [approval] = await ctx.db
        .insert(Approval)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          approvalType: input.approvalType,
          entityType: input.entityType,
          entityId: input.entityId,
          requestedBy: ctx.user.id,
          reason: input.reason,
          metadata: input.metadata,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "approval.request",
        entity: "approval",
        entityId: approval?.id,
        newValue: {
          type: input.approvalType,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      });

      return approval;
    }),

  // ─── Approve ──────────────────────────────────
  approve: wsPermissionProcedure("dashboard", "approve")
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo supervisores, administradores o propietarios pueden aprobar solicitudes",
        });
      }

      const [approval] = await ctx.db
        .select()
        .from(Approval)
        .where(
          and(
            eq(Approval.id, input.id),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!approval) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solicitud de aprobación no encontrada",
        });
      }

      if (approval.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La solicitud ya fue ${approval.status === "approved" ? "aprobada" : "rechazada"}`,
        });
      }

      if (approval.requestedBy === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Separación de funciones: no puedes auto-aprobar tu propia solicitud",
        });
      }

      const [updated] = await ctx.db
        .update(Approval)
        .set({
          status: "approved",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          reason: input.reason,
        })
        .where(
          and(
            eq(Approval.id, input.id),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      // Create signature record
      if (updated) {
        await ctx.db.insert(Signature).values({
          workspaceId: ctx.workspace.workspaceId,
          approvalId: input.id,
          signedBy: ctx.user.id,
          role: ctx.workspace.role as "owner" | "admin" | "supervisor",
          action: "approve",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "approval.approve",
        entity: "approval",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Reject ───────────────────────────────────
  reject: wsPermissionProcedure("dashboard", "approve")
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Se requiere razón de rechazo"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo supervisores, administradores o propietarios pueden rechazar solicitudes",
        });
      }

      const [approval] = await ctx.db
        .select()
        .from(Approval)
        .where(
          and(
            eq(Approval.id, input.id),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!approval) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solicitud de aprobación no encontrada",
        });
      }

      if (approval.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La solicitud ya fue ${approval.status === "approved" ? "aprobada" : "rechazada"}`,
        });
      }

      if (approval.requestedBy === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Separación de funciones: no puedes rechazar tu propia solicitud",
        });
      }

      const [updated] = await ctx.db
        .update(Approval)
        .set({
          status: "rejected",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          reason: input.reason,
        })
        .where(
          and(
            eq(Approval.id, input.id),
            eq(Approval.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (updated) {
        await ctx.db.insert(Signature).values({
          workspaceId: ctx.workspace.workspaceId,
          approvalId: input.id,
          signedBy: ctx.user.id,
          role: ctx.workspace.role as "owner" | "admin" | "supervisor",
          action: "reject",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "approval.reject",
        entity: "approval",
        entityId: input.id,
        newValue: { reason: input.reason },
      });

      return updated;
    }),
});
