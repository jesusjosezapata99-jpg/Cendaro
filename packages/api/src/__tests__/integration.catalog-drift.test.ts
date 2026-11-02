/**
 * Column names and types of the Drizzle schema against the database catalog. It
 * reads only pg_catalog, so it can also run against production with a role that
 * cannot read any row:
 *
 *   $env:SCHEMA_DRIFT_URL = "<catalog-only connection string>"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.catalog-drift.test.ts
 */
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import pg from "pg";
import { describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

const URL_UNDER_TEST =
  process.env.SCHEMA_DRIFT_URL ?? process.env.TEST_DATABASE_URL;

const tables = Object.values(schema as Record<string, unknown>).filter(
  (value): value is Table => is(value, Table),
);

const toSnakeCase = (key: string): string =>
  key.replace(/(?<=[a-z0-9])[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** `numeric(14, 2)` and `numeric(14,2)` are the same type. */
const normalizeType = (type: string): string =>
  type.replaceAll(/,\s+/g, ",").toLowerCase();

/** Only the types that decide how money is stored and rounded. */
const isCheckedType = (type: string): boolean =>
  type.startsWith("numeric") || type === "double precision";

describe.skipIf(!URL_UNDER_TEST)("Drizzle schema against pg_catalog", () => {
  it("every column exists with the declared numeric type", async () => {
    const client = new pg.Client({ connectionString: URL_UNDER_TEST });
    await client.connect();
    try {
      const { rows } = await client.query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(
        `SELECT c.relname AS table_name, a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS data_type
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND a.attnum > 0 AND NOT a.attisdropped`,
      );
      const actual = new Map(
        rows.map((row) => [
          `${row.table_name}.${row.column_name}`,
          row.data_type,
        ]),
      );

      const drift = tables.flatMap((table) =>
        Object.entries(getTableColumns(table)).flatMap(([key, column]) => {
          const name = column.keyAsName ? toSnakeCase(key) : column.name;
          const id = `${getTableName(table)}.${name}`;
          const found = actual.get(id);
          if (!found) return [`${id}: missing`];
          const declared = normalizeType(column.getSQLType());
          return isCheckedType(declared) && declared !== normalizeType(found)
            ? [`${id}: schema ${declared}, database ${found}`]
            : [];
        }),
      );

      expect(drift).toEqual([]);
    } finally {
      await client.end();
    }
  });
});
