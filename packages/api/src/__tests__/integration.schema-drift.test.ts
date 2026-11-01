/**
 * The Drizzle schema against the migrated database, table by table and enum by
 * enum. Only reads, through the same casing as getDb(), so a column name that
 * Drizzle would generate differently from the migration fails here and not on
 * the first production query.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.schema-drift.test.ts
 */
import type { PgEnum } from "drizzle-orm/pg-core";
import { getTableName, is, sql, Table } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { isPgEnum } from "drizzle-orm/pg-core";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

const TEST_URL = process.env.TEST_DATABASE_URL;

const exported: unknown[] = Object.values(schema);
const tables = exported.filter((value): value is Table => is(value, Table));
const enums = exported.filter((value): value is PgEnum<[string, ...string[]]> =>
  isPgEnum(value),
);

// Without this, a CI job that lost its database would skip every suite and pass.
it.runIf(process.env.REQUIRE_TEST_DATABASE)(
  "has a database to test against",
  () => {
    expect(TEST_URL).toBeTruthy();
  },
);

describe.skipIf(!TEST_URL)("Drizzle schema against the database", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: TEST_URL, max: 2 });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("finds the tables and enums of the schema", () => {
    expect(tables.length).toBeGreaterThan(50);
    expect(enums.length).toBeGreaterThan(20);
  });

  it(
    "every table and column of the schema exists, and no column is unknown",
    {
      timeout: 60_000,
    },
    async () => {
      const db = drizzle(pool, { schema, casing: "snake_case" });
      const drift: string[] = [];

      for (const table of tables) {
        const name = getTableName(table);
        const query = db.select().from(table).toSQL();
        const result = await db
          .execute(sql.raw(`${query.sql} limit 0`))
          .catch((error: Error) => {
            const cause = error.cause as Error | undefined;
            drift.push(`${name}: ${cause?.message ?? error.message}`);
            return null;
          });
        if (!result) continue;

        const expected = new Set(result.fields.map((field) => field.name));
        const { rows } = await pool.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
          [name],
        );
        for (const { column_name: column } of rows) {
          if (!expected.has(column))
            drift.push(`${name}.${column}: not in schema`);
        }
      }

      expect(drift, drift.join(" | ")).toEqual([]);
    },
  );

  it("every enum has the same values in both places", async () => {
    const { rows } = await pool.query<{ name: string; labels: string[] }>(
      `SELECT t.typname AS name,
              array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       GROUP BY t.typname`,
    );
    const inDatabase = new Map(rows.map((r) => [r.name, r.labels]));

    const drift = enums.flatMap((item) => {
      const labels = inDatabase.get(item.enumName);
      if (!labels) return [`${item.enumName}: missing`];
      const missing = item.enumValues.filter((v) => !labels.includes(v));
      const unknown = labels.filter((v) => !item.enumValues.includes(v));
      return missing.length + unknown.length > 0
        ? [
            `${item.enumName}: missing ${missing.join()} unknown ${unknown.join()}`,
          ]
        : [];
    });

    expect(drift, drift.join(" | ")).toEqual([]);
  });
});
