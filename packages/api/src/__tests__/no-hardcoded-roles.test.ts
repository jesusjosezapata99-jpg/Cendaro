/**
 * Who may do what lives in ROLE_PERMISSIONS and reaches a procedure through its
 * builder, which records meta.authz. A role list inside a module can drift from
 * the matrix without any test noticing, so none may appear there.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULES_DIR = path.resolve(import.meta.dirname, "../modules");

const ROLE_LIST =
  /(?<!enum\()\[\s*"(?:owner|admin|supervisor|employee|vendor|marketing)"\s*,/g;

function moduleSources(): [string, string][] {
  return readdirSync(MODULES_DIR)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => [file, readFileSync(path.join(MODULES_DIR, file), "utf8")]);
}

describe("role checks in API modules", () => {
  it("reads the module sources", () => {
    expect(moduleSources().length).toBeGreaterThan(15);
  });

  it("detects a role list and ignores a z.enum of roles", () => {
    expect(
      `if (!["owner", "admin"].includes(role)) {}`.match(ROLE_LIST),
    ).toHaveLength(1);
    expect(`z.enum(["admin", "supervisor"])`.match(ROLE_LIST)).toBeNull();
  });

  it("no module keeps its own list of roles", () => {
    const offenders = moduleSources().flatMap(([file, source]) =>
      (source.match(ROLE_LIST) ?? []).map((match) => `${file}: ${match}`),
    );
    expect(offenders).toEqual([]);
  });
});
