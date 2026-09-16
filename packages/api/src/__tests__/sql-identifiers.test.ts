/**
 * Raw-SQL identifier guard (PLAN-2026-09-PROD-HARDENING, phase F2).
 *
 * The DB uses snake_case columns (drizzle `casing: "snake_case"`), but raw
 * `sql`…`` templates bypass Drizzle's column mapping. A quoted camelCase
 * identifier such as `c."workspaceId"` compiles fine and only fails at
 * runtime with 42703 — which silently broke catalogImport.validate
 * (2026-09-15 audit). This test scans the API sources and fails on:
 *   A. alias-qualified quoted camelCase identifiers:  c."workspaceId"
 *   B. bare quoted camelCase identifiers on a line that also contains an
 *      SQL keyword:  WHERE "categoryId" = …
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));

const ALIAS_QUALIFIED = /\b[a-z_][a-z0-9_]*\."[a-z]+[A-Z][A-Za-z0-9]*"/;
const BARE_IN_SQL = /"[a-z]+[A-Z][A-Za-z0-9]*"\s*(=|<>|!=|\bIS\b|\bIN\b|,|\))/;
const SQL_KEYWORD =
  /\b(SELECT|WHERE|AND|OR|ON|JOIN|SET|ORDER BY|GROUP BY|HAVING|RETURNING)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

function findOffenders(): string[] {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC_DIR)) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const bare = BARE_IN_SQL.test(line) && SQL_KEYWORD.test(line);
        if (ALIAS_QUALIFIED.test(line) || bare) {
          offenders.push(`${relative(SRC_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  return offenders;
}

describe("raw SQL identifiers", () => {
  it("scans the API sources", () => {
    expect(sourceFiles(SRC_DIR).length).toBeGreaterThan(10);
  });

  it("never uses quoted camelCase column names (DB columns are snake_case)", () => {
    expect(findOffenders()).toEqual([]);
  });
});
