/**
 * Cendaro — Approvals Router
 *
 * PRD §23: Approval workflow for price changes, container close, cash closure, etc.
 * @see docs/architecture/module_api_blueprint_v1.md — Audit & Approvals
 *
 * Resolution rules (PLAN-2026-09-SECURITY-REMEDIATION F4.4):
 *  - the request is locked FOR UPDATE while it is resolved and the update
 *    only matches a still-pending row, so two resolvers cannot both decide;
 *  - only pending, unexpired requests can be resolved;
 *  - nobody resolves their own request (segregation of duties), except the
 *    held exchange rates the server opens itself (see modules/rate-sync);
 *  - the requester's `reason` is never overwritten: the resolver's note goes
 *    to `metadata.resolutionNote` and to the audit log.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { Approval, approvalTypeEnum, Signature } from "@cendaro/db/schema";

import type { createTRPCContext, UserRole } from "../trpc";
import { createTRPCRouter, wsPermissionProcedure } from "../trpc";
import { logAudit } from "./audit";
import {
  applyHeldRateApproval,
  dismissApprovalAlerts,
  dismissRateTypeAlerts,
  HELD_RATE_ENTITY,
  lockHeldRateApproval,
  parseHeldRate,
} from "./rate-sync";

type Db = ReturnType<typeof createTRPCContext>["db"];
type ApprovalRow = typeof Approval.$inferSelect;

/** Entity types whose requests only the server opens. */
const RESERVED_ENTITY_TYPES: readonly string[] = [HELD_RATE_ENTITY];

const RESOLVER_ROLES: readonly UserRole[] = ["owner", "admin", "supervisor"];

const RESOLVED_STATUS_TEXT: Record<string, string> = {
  approved: "fue aprobada",
  rejected: "fue rechazada",
  expired: "expiró",
};

function assertResolverRole(role: UserRole, message: string): void {
  if (!RESOLVER_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

/** Not past its expiry (requests without expiry never expire). */
function isLive(now: Date) {
  return or(isNull(Approval.expiresAt), gt(Approval.expiresAt, now));
}

/**
 * Loads a request for resolution, locked until the transaction ends. Throws
 * unless it is pending, unexpired and (for member requests) not the caller's.
 */
async function loadForResolution(
  db: Db,
  workspaceId: string,
  approvalId: string,
  userId: string,
  ownRequestMessage: string,
): Promise<ApprovalRow> {
  const [approval] = await db
    .select()
    .from(Approval)
    .where(
      and(eq(Approval.id, approvalId), eq(Approval.workspaceId, workspaceId)),
    )
    .limit(1)
    .for("update");

  if (!approval) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Solicitud de aprobación no encontrada",
    });
  }
  if (approval.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `La solicitud ya ${RESOLVED_STATUS_TEXT[approval.status] ?? "fue resuelta"}`,
    });
  }
  if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La solicitud expiró",
    });
  }
  // A held exchange rate is opened by the server: the member whose page load
  // triggered the sync did not choose the value, so they may resolve it —
  // accepting it still requires owner/admin (applyHeldRateApproval).
  const openedByServer = RESERVED_ENTITY_TYPES.includes(approval.entityType);
  if (approval.requestedBy === userId && !openedByServer) {
    throw new TRPCError({ code: "FORBIDDEN", message: ownRequestMessage });
  }
  return approval;
}

/** Marks a still-pending request as resolved; CONFLICT if someone won the race. */
async function resolveApproval(
  db: Db,
  workspaceId: string,
  approvalId: string,
  userId: string,
  status: "approved" | "rejected",
  note: string | undefined,
): Promise<ApprovalRow> {
  const [resolved] = await db
    .update(Approval)
    .set({
      status,
      resolvedBy: userId,
      resolvedAt: new Date(),
      ...(note
        ? {
            metadata: sql`coalesce(${Approval.metadata}, '{}'::jsonb) || jsonb_build_object('resolutionNote', ${note}::text)`,
          }
        : {}),
    })
    .where(
      and(
        eq(Approval.id, approvalId),
        eq(Approval.workspaceId, workspaceId),
        eq(Approval.status, "pending"),
      ),
    )
    .returning();

  if (!resolved) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "La solicitud ya fue resuelta por otra persona",
    });
  }
  return resolved;
}

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
            isLive(new Date()),
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
        reason: z.string().max(1000).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (RESERVED_ENTITY_TYPES.includes(input.entityType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este tipo de solicitud solo lo genera el sistema",
        });
      }
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fecha de vencimiento debe ser futura",
        });
      }

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
          expiresAt,
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
        reason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertResolverRole(
        ctx.workspace.role,
        "Solo supervisores, administradores o propietarios pueden aprobar solicitudes",
      );
      const workspaceId = ctx.workspace.workspaceId;

      // Same lock order as the rate sync (rate type, then approval row).
      await lockHeldRateApproval(ctx.db, workspaceId, input.id);
      const approval = await loadForResolution(
        ctx.db,
        workspaceId,
        input.id,
        ctx.user.id,
        "Separación de funciones: no puedes auto-aprobar tu propia solicitud",
      );
      const heldRate = parseHeldRate(approval);
      if (approval.entityType === HELD_RATE_ENTITY && !heldRate) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "La solicitud de tasa está incompleta: recházala y vuelve a sincronizar las tasas",
        });
      }

      const updated = await resolveApproval(
        ctx.db,
        workspaceId,
        input.id,
        ctx.user.id,
        "approved",
        input.reason,
      );
      if (heldRate) {
        await applyHeldRateApproval(
          ctx.db,
          ctx.user,
          workspaceId,
          approval,
          heldRate,
        );
      }

      await ctx.db.insert(Signature).values({
        workspaceId,
        approvalId: input.id,
        signedBy: ctx.user.id,
        role: ctx.workspace.role as "owner" | "admin" | "supervisor",
        action: "approve",
      });

      await logAudit(ctx.db, ctx.user, {
        workspaceId,
        action: "approval.approve",
        entity: "approval",
        entityId: input.id,
        newValue: input.reason ? { reason: input.reason } : undefined,
      });

      return updated;
    }),

  // ─── Reject ───────────────────────────────────
  reject: wsPermissionProcedure("dashboard", "approve")
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Se requiere razón de rechazo").max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertResolverRole(
        ctx.workspace.role,
        "Solo supervisores, administradores o propietarios pueden rechazar solicitudes",
      );
      const workspaceId = ctx.workspace.workspaceId;

      // Same lock order as the rate sync (rate type, then approval row).
      await lockHeldRateApproval(ctx.db, workspaceId, input.id);
      const approval = await loadForResolution(
        ctx.db,
        workspaceId,
        input.id,
        ctx.user.id,
        "Separación de funciones: no puedes rechazar tu propia solicitud",
      );
      const updated = await resolveApproval(
        ctx.db,
        workspaceId,
        input.id,
        ctx.user.id,
        "rejected",
        input.reason,
      );
      const heldRate = parseHeldRate(approval);
      if (heldRate) {
        const now = new Date();
        await dismissApprovalAlerts(
          ctx.db,
          workspaceId,
          [input.id],
          ctx.user,
          now,
        );
        await dismissRateTypeAlerts(
          ctx.db,
          workspaceId,
          heldRate.rateType,
          ctx.user,
          now,
        );
      }

      await ctx.db.insert(Signature).values({
        workspaceId,
        approvalId: input.id,
        signedBy: ctx.user.id,
        role: ctx.workspace.role as "owner" | "admin" | "supervisor",
        action: "reject",
      });

      await logAudit(ctx.db, ctx.user, {
        workspaceId,
        action: "approval.reject",
        entity: "approval",
        entityId: input.id,
        newValue: { reason: input.reason },
      });

      return updated;
    }),
});
