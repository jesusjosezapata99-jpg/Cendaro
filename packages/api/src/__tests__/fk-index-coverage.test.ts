/**
 * Foreign-key index coverage (PLAN-2026-09-PROD-HARDENING, phase F7).
 *
 * Postgres does not index foreign keys automatically. Without an index whose
 * leading columns are the FK columns, every DELETE/UPDATE of a referenced row
 * scans the whole referencing table and joins on the FK cannot use an index
 * (Supabase lint 0001 unindexed_foreign_keys). `schema.ts` must declare the
 * covering index — drizzle-kit drops indexes it does not know about.
 */
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

// Widen to unknown first: the schema module also exports enums and relations,
// and a type predicate must be assignable to the element type it narrows.
const tables = Object.entries(schema as Record<string, unknown>).filter(
  (entry): entry is [string, PgTable] => is(entry[1], PgTable),
);

/** Column name of an index element; SQL expressions never cover a FK. */
function columnName(element: unknown): string {
  return typeof element === "object" &&
    element !== null &&
    "name" in element &&
    typeof element.name === "string"
    ? element.name
    : "<expression>";
}

/** Ordered column lists of every index/constraint that can serve FK lookups. */
function indexedColumnLists(table: PgTable): string[][] {
  const config = getTableConfig(table);
  return [
    ...config.indexes.map((idx) => idx.config.columns.map(columnName)),
    ...config.uniqueConstraints.map((uc) => uc.columns.map((c) => c.name)),
    ...config.primaryKeys.map((pk) => pk.columns.map((c) => c.name)),
    ...config.columns
      .filter((col) => col.primary || col.isUnique)
      .map((col) => [col.name]),
  ];
}

/** Covered when some list starts with exactly the FK columns (any order). */
function isCovered(fkColumns: string[], lists: string[][]): boolean {
  const wanted = [...fkColumns].sort().join(",");
  return lists.some(
    (list) =>
      list.length >= fkColumns.length &&
      list.slice(0, fkColumns.length).sort().join(",") === wanted,
  );
}

const foreignKeys = tables.flatMap(([, table]) => {
  const config = getTableConfig(table);
  const lists = indexedColumnLists(table);
  return config.foreignKeys.map((fk) => {
    const columns = fk.reference().columns.map((c) => c.name);
    return [
      `${config.name}(${columns.join(",")})`,
      isCovered(columns, lists),
    ] as const;
  });
});

describe("foreign-key index coverage", () => {
  it("finds the schema foreign keys", () => {
    expect(foreignKeys.length).toBeGreaterThan(60);
  });

  it.each(foreignKeys)("%s has a covering index", (_fk, covered) => {
    expect(covered).toBe(true);
  });
});
