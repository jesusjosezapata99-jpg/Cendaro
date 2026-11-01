/**
 * Foreign keys do not pass through RLS, so an id sent by the client could point
 * at another workspace's row. Check it before storing the reference.
 */
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";

type WorkspaceTable = PgTable & { id: AnyPgColumn; workspaceId: AnyPgColumn };

export async function assertInWorkspace(
  db: ReturnType<typeof getDb>,
  table: WorkspaceTable,
  id: string | null | undefined,
  workspaceId: string,
  label: string,
): Promise<void> {
  if (!id) return;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.workspaceId, workspaceId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${label} no encontrado en este espacio de trabajo`,
    });
  }
}

export async function assertAllInWorkspace(
  db: ReturnType<typeof getDb>,
  table: WorkspaceTable,
  ids: readonly string[],
  workspaceId: string,
  label: string,
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(inArray(table.id, unique), eq(table.workspaceId, workspaceId)));
  if (rows.length !== unique.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${label} no encontrado en este espacio de trabajo`,
    });
  }
}
