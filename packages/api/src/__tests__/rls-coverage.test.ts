/**
 * RLS coverage invariants (PLAN-2026-09-PROD-HARDENING, phases F1 and F6).
 *
 * The 2026-09-15 audit found 5 identity/RBAC tables without RLS and fully
 * readable/writable through the public anon key. `schema.ts` is the source
 * of truth for RLS (drizzle-kit reconciles it), so these tests make a
 * regression impossible to merge:
 *   1. every table in the schema has row level security;
 *   2. the identity/RBAC tables declare exactly the app_user policies the
 *      API needs — no more (e.g. no DELETE), no less;
 *   3. every policy reads `app.workspace_id` once per statement (InitPlan),
 *      in the exact form Supabase's advisor recognises.
 */
import type { SQL } from "drizzle-orm";
import { is } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

// Widen to unknown first: the schema module also exports enums and relations,
// and a type predicate must be assignable to the element type it narrows.
const tables = Object.entries(schema as Record<string, unknown>).filter(
  (entry): entry is [string, PgTable] => is(entry[1], PgTable),
);

function hasRls(table: PgTable): boolean {
  const config = getTableConfig(table);
  // drizzle-kit enables RLS for any table that declares a policy.
  return config.enableRLS || config.policies.length > 0;
}

function policies(table: PgTable) {
  return getTableConfig(table)
    .policies.map((p) => ({ name: p.name, for: p.for ?? "all" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

describe("RLS coverage", () => {
  it("finds the schema tables", () => {
    expect(tables.length).toBeGreaterThan(60);
  });

  it.each(tables)("%s has row level security", (_name, table) => {
    expect(hasRls(table)).toBe(true);
  });
});

describe("identity & RBAC table policies", () => {
  it("organization has RLS and no policy (default-deny for app_user)", () => {
    expect(getTableConfig(schema.Organization).enableRLS).toBe(true);
    expect(policies(schema.Organization)).toEqual([]);
  });

  it("user_profile allows app_user select/insert/update only", () => {
    expect(policies(schema.UserProfile)).toEqual([
      { name: "user_profile_app_user_insert", for: "insert" },
      { name: "user_profile_app_user_select", for: "select" },
      { name: "user_profile_app_user_update", for: "update" },
    ]);
  });

  it("workspace allows app_user select and update only", () => {
    expect(policies(schema.Workspace)).toEqual([
      { name: "workspace_app_user_select", for: "select" },
      { name: "workspace_app_user_update", for: "update" },
    ]);
  });

  it("permission and role_permission are read-only for app_user", () => {
    expect(policies(schema.Permission)).toEqual([
      { name: "permission_app_user_select", for: "select" },
    ]);
    expect(policies(schema.RolePermission)).toEqual([
      { name: "role_permission_app_user_select", for: "select" },
    ]);
  });

  it("no identity/RBAC policy grants DELETE or ALL", () => {
    for (const table of [
      schema.UserProfile,
      schema.Workspace,
      schema.Permission,
      schema.RolePermission,
    ]) {
      for (const p of policies(table)) {
        expect(["delete", "all"]).not.toContain(p.for);
      }
    }
  });
});

describe("RLS policy performance (initplan)", () => {
  const dialect = new PgDialect();
  // A bare current_setting() is re-evaluated for every row. Wrapped in a
  // scalar subquery it becomes an InitPlan evaluated once per statement. The
  // cast must stay OUTSIDE the subquery: "(select current_setting(...)::uuid)"
  // is also an InitPlan, but Supabase lint 0003 (auth_rls_initplan) only
  // recognises the text "select current_setting(" and keeps flagging it.
  const ONCE_PER_STATEMENT =
    /\(select current_setting\('app\.workspace_id', true\)\)::uuid/i;

  const clauses = tables.flatMap(([name, table]) =>
    getTableConfig(table).policies.flatMap((p) =>
      [p.using, p.withCheck]
        .filter((clause): clause is SQL => clause !== undefined)
        .map((clause) => [`${name}.${p.name}`, dialect.sqlToQuery(clause).sql]),
    ),
  );
  const settingClauses = clauses.filter(([, text]) =>
    text?.includes("current_setting"),
  );

  it("finds the workspace policy clauses", () => {
    expect(settingClauses.length).toBeGreaterThan(120);
  });

  it.each(settingClauses)(
    "%s reads app.workspace_id once per statement",
    (_policy, text) => {
      expect(text).toMatch(ONCE_PER_STATEMENT);
    },
  );
});
