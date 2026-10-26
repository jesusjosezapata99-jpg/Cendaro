/**
 * Cendaro — Audit Router
 *
 * Read-only access to audit log entries and WORM cryptographic chain verification.
 * Admin/owner only.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";

import { AuditLog } from "@cendaro/db/schema";

import { createTRPCRouter, wsReadPermissionProcedure } from "../trpc";
import { verifyAuditChain } from "./audit";

export const auditRouter = createTRPCRouter({
  /** List audit log entries with filters and pagination */
  list: wsReadPermissionProcedure("audit", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        entity: z.string().max(64).optional(),
        action: z.string().max(128).optional(),
        actorId: z.string().uuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!["owner", "admin"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Requiere rol de Administrador o Propietario para consultar la bitácora de auditoría",
        });
      }

      const conditions = [eq(AuditLog.workspaceId, ctx.workspace.workspaceId)];

      if (input.entity) conditions.push(eq(AuditLog.entity, input.entity));
      if (input.action) conditions.push(eq(AuditLog.action, input.action));
      if (input.actorId) conditions.push(eq(AuditLog.actorId, input.actorId));
      if (input.from) conditions.push(gte(AuditLog.createdAt, input.from));
      if (input.to) conditions.push(lte(AuditLog.createdAt, input.to));

      const rows = await ctx.db
        .select()
        .from(AuditLog)
        .where(and(...conditions))
        .orderBy(desc(AuditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  /** Get single audit entry by ID */
  byId: wsReadPermissionProcedure("audit", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!["owner", "admin"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Requiere rol de Administrador o Propietario para consultar la bitácora de auditoría",
        });
      }

      const [entry] = await ctx.db
        .select()
        .from(AuditLog)
        .where(
          and(
            eq(AuditLog.id, input.id),
            eq(AuditLog.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);
      return entry ?? null;
    }),

  /**
   * Verify WORM cryptographic hash-chain integrity across workspace audit logs (F10.4).
   * Returns a signed verification manifest suitable for external auditors (SOC 1 / SOC 2).
   */
  verifyChainIntegrity: wsReadPermissionProcedure("audit", "read")
    .input(
      z
        .object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          limit: z.number().int().min(1).max(1000).default(500),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!["owner", "admin"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Requiere rol de Administrador o Propietario para verificar la cadena criptográfica de auditoría",
        });
      }

      const conditions = [eq(AuditLog.workspaceId, ctx.workspace.workspaceId)];
      if (input?.from) conditions.push(gte(AuditLog.createdAt, input.from));
      if (input?.to) conditions.push(lte(AuditLog.createdAt, input.to));

      const rows = await ctx.db
        .select()
        .from(AuditLog)
        .where(and(...conditions))
        .orderBy(asc(AuditLog.createdAt))
        .limit(input?.limit ?? 500);

      const normalizedRows = rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        oldValue: r.oldValue,
        newValue: r.newValue,
        metadata: (r.metadata ?? null) as Record<string, unknown> | null,
        prevHash: r.prevHash,
        chainHash: r.chainHash,
      }));

      const verification = verifyAuditChain(normalizedRows);

      return {
        workspaceId: ctx.workspace.workspaceId,
        ...verification,
      };
    }),
});
