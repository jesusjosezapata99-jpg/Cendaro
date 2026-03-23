/**
 * Cendaro — Approvals Router
 *
 * PRD §23: Approval workflow for price changes, container close, cash closure, etc.
 * @see docs/architecture/module_api_blueprint_v1.md — Audit & Approvals
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { approvalStatusEnum } from "@cendaro/db/schema";
import { Approval, approvalTypeEnum, Signature } from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const approvalsRouter = createTRPCRouter({
  // ─── List pending approvals ───────────────────
  listPending: workspaceProcedure
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
        .where(eq(Approval.status, "pending"))
        .orderBy(desc(Approval.requestedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── List all approvals ───────────────────────
  list: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        type: z.enum(approvalTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
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
        .$dynamic();

      if (input.type) {
        query = query.where(eq(Approval.approvalType, input.type));
      }

      return query
        .orderBy(desc(Approval.requestedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get approval by ID with signatures ───────
  byId: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [approval] = await ctx.db
        .select()
        .from(Approval)
        .where(eq(Approval.id, input.id))
        .limit(1);

      if (!approval) return null;

      const signatures = await ctx.db
        .select()
        .from(Signature)
        .where(eq(Signature.approvalId, input.id));

      return { ...approval, signatures };
    }),

  // ─── Request approval ─────────────────────────
  request: workspaceProcedure
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
  approve: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userRole = (ctx.user.user_metadata as { role?: string } | undefined)
        ?.role;

      const [updated] = await ctx.db
        .update(Approval)
        .set({
          status: "approved" as (typeof approvalStatusEnum.enumValues)[number],
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          reason: input.reason,
        })
        .where(eq(Approval.id, input.id))
        .returning();

      // Create signature record
      if (updated && userRole) {
        await ctx.db.insert(Signature).values({
          approvalId: input.id,
          signedBy: ctx.user.id,
          role: userRole as "owner" | "admin" | "supervisor",
          action: "approve",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "approval.approve",
        entity: "approval",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Reject ───────────────────────────────────
  reject: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Se requiere razón de rechazo"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userRole = (ctx.user.user_metadata as { role?: string } | undefined)
        ?.role;

      const [updated] = await ctx.db
        .update(Approval)
        .set({
          status: "rejected" as (typeof approvalStatusEnum.enumValues)[number],
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          reason: input.reason,
        })
        .where(eq(Approval.id, input.id))
        .returning();

      if (updated && userRole) {
        await ctx.db.insert(Signature).values({
          approvalId: input.id,
          signedBy: ctx.user.id,
          role: userRole as "owner" | "admin" | "supervisor",
          action: "reject",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "approval.reject",
        entity: "approval",
        entityId: input.id,
        newValue: { reason: input.reason },
      });

      return updated;
    }),
});
