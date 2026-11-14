/**
 * Warns when the deployed code expects a migration production does not have. The
 * daily cron calls it: migrations are applied by hand, so a missed one would
 * otherwise only show up as a failing query in front of a user.
 */
import { sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";

import { logger } from "../logger";

/** Name of the newest migration in packages/db/migrations; a test keeps it current. */
export const EXPECTED_MIGRATION = "monitor_audit_chain";

export interface SchemaVersionStatus {
  expected: string;
  applied: boolean;
}

export async function checkSchemaVersion(
  db: Pick<ReturnType<typeof getDb>, "execute">,
): Promise<SchemaVersionStatus> {
  let applied = false;
  try {
    const result = await db.execute(
      sql`SELECT 1 FROM supabase_migrations.schema_migrations WHERE name = ${EXPECTED_MIGRATION} LIMIT 1`,
    );
    applied = result.rows.length > 0;
  } catch (error) {
    logger.error("schema version check failed", {}, error);
  }
  if (!applied) {
    logger.error("production is missing the expected migration", {
      module: "schema-version",
      expected: EXPECTED_MIGRATION,
    });
  }
  return { expected: EXPECTED_MIGRATION, applied };
}
