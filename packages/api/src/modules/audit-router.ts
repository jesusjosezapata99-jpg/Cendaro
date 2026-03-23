/**
 * Cendaro — Audit Router
 *
 * Read-only access to audit log entries. Admin/owner only.
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";

import { AuditLog } from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const auditRouter = createTRPCRouter({
  /** List audit log entries with filters and pagination */
  list: workspaceProcedure
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
      const conditions = [];

      if (input.entity) conditions.push(eq(AuditLog.entity, input.entity));
      if (input.action) conditions.push(eq(AuditLog.action, input.action));
      if (input.actorId) conditions.push(eq(AuditLog.actorId, input.actorId));
      if (input.from) conditions.push(gte(AuditLog.createdAt, input.from));
      if (input.to) conditions.push(lte(AuditLog.createdAt, input.to));

      const rows = await ctx.db
        .select()
        .from(AuditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(AuditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  /** Get single audit entry by ID */
  byId: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(AuditLog)
        .where(eq(AuditLog.id, input.id))
        .limit(1);
      return entry ?? null;
    }),
});
