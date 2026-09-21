/**
 * SECURITY DEFINER hygiene in migrations (PLAN-2026-09-PROD-HARDENING F3).
 *
 * Postgres grants EXECUTE on new functions to PUBLIC, and per-schema default
 * privileges cannot take that away (migration 005). A SECURITY DEFINER
 * function left executable by anon/authenticated is callable through
 * POST /rest/v1/rpc/<name> and runs with its owner's rights. Every migration
 * that creates or replaces one must revoke EXECUTE in the same file and pin
 * its search_path.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../db/migrations/", import.meta.url),
);

/**
 * Drops SQL comments so prose that mentions SECURITY DEFINER is not counted
 * as a function, and a commented-out REVOKE cannot satisfy the guard.
 */
function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !file.endsWith(".rollback.sql"))
  .map(
    (file) =>
      [
        file,
        stripSqlComments(readFileSync(`${migrationsDir}${file}`, "utf8")),
      ] as const,
  );

/** [migration, function name, definition text] for each SECURITY DEFINER function. */
const definerFunctions = migrations.flatMap(([file, text]) =>
  [
    // Any dollar-quoted body ($function$, $$, $body$…), so a future function
    // cannot dodge this guard by changing its quoting tag.
    ...text.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(\w+)\s*\([\s\S]*?AS\s+(\$\w*\$)[\s\S]*?\2\s*;/gi,
    ),
  ]
    .filter((match) => /SECURITY\s+DEFINER/i.test(match[0]))
    .map((match) => [file, match[1] ?? "", match[0]] as const),
);

describe("SECURITY DEFINER functions in migrations", () => {
  it("finds every SECURITY DEFINER function of the migrations", () => {
    const declared = migrations.reduce(
      (total, [, text]) =>
        total + (text.match(/SECURITY\s+DEFINER/gi) ?? []).length,
      0,
    );
    expect(definerFunctions.length).toBe(declared);
    expect(definerFunctions.length).toBeGreaterThanOrEqual(4);
  });

  it("does not count commented-out SQL", () => {
    const text = stripSqlComments(
      "-- REVOKE EXECUTE ON FUNCTION public.f() FROM PUBLIC, anon, authenticated;\n" +
        "/* SECURITY DEFINER */ SELECT 1; -- SECURITY DEFINER",
    );
    expect(text).not.toMatch(/REVOKE|SECURITY/i);
    expect(text).toContain("SELECT 1;");
  });

  it.each(definerFunctions)(
    "%s: %s revokes EXECUTE from PUBLIC, anon and authenticated",
    (file, name) => {
      const text = migrations.find(([f]) => f === file)?.[1] ?? "";
      const revoke = new RegExp(
        `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION[^;]*public\\.${name}\\s*\\([^;]*FROM\\s+PUBLIC,\\s*anon,\\s*authenticated`,
        "i",
      );
      expect(text).toMatch(revoke);
    },
  );

  it.each(definerFunctions)(
    "%s: %s pins its search_path",
    (_file, _name, definition) => {
      expect(definition).toMatch(/SET\s+search_path\s+(?:TO|=)/i);
    },
  );
});
