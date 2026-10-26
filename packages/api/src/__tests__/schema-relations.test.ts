import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

const STANDALONE_INFRA_TABLES = new Set([
  "RateLimitBucket",
  "RateLimitLockout",
]);

describe("Database Schema & Migration Integrity (DCG-F1)", () => {
  it("exports a Drizzle relations() definition for every domain pgTable", () => {
    const schemaPath = path.resolve(
      import.meta.dirname,
      "../../../db/src/schema.ts",
    );
    const src = readFileSync(schemaPath, "utf8");
    const tableExports = [
      ...src.matchAll(/^export const (\w+) = pgTable\(/gm),
    ].map((m) => m[1] ?? "");

    expect(tableExports.length).toBeGreaterThanOrEqual(68);

    const missingRelations: string[] = [];
    for (const tableName of tableExports) {
      if (!tableName || STANDALONE_INFRA_TABLES.has(tableName)) continue;
      const expectedRelationName = `${tableName.charAt(0).toLowerCase()}${tableName.slice(1)}Relations`;
      if (!(expectedRelationName in schema)) {
        missingRelations.push(
          `${tableName} (expected ${expectedRelationName})`,
        );
      }
    }

    expect(missingRelations).toEqual([]);
  });

  it("includes baseline 000_initial_schema.sql and trigger fix 023_fix_broken_triggers_and_sequences.sql", () => {
    const migrationsDir = path.resolve(
      import.meta.dirname,
      "../../../db/migrations",
    );
    const baselinePath = path.join(migrationsDir, "000_initial_schema.sql");
    const triggerFixPath = path.join(
      migrationsDir,
      "023_fix_broken_triggers_and_sequences.sql",
    );

    expect(existsSync(baselinePath)).toBe(true);
    expect(existsSync(triggerFixPath)).toBe(true);

    const triggerFixSql = readFileSync(triggerFixPath, "utf8");
    expect(triggerFixSql).toContain("DROP TRIGGER IF EXISTS trg_price_history");
    expect(triggerFixSql).toContain("public.record_price_change()");
    expect(triggerFixSql).toContain("public.generate_order_number()");
    expect(triggerFixSql).toContain("public.next_document_number(");
  });
});
