/**
 * F9.5 — REAL-database security tests (finding L5).
 *
 * The unit suites mock the database, which is how the F9.2 first draft
 * shipped a multi-statement batch that node-postgres's extended protocol
 * would have rejected at runtime — mocks cannot catch driver-level
 * behavior. This suite runs the REAL `runInWorkspaceRlsReadonly` against a
 * REAL migrated Postgres and verifies the properties that matter:
 *
 *   1. a read WITHOUT a workspace_id WHERE clause still only sees the
 *      current workspace (RLS as defense in depth — finding M9's exact
 *      scenario);
 *   2. the transaction really runs as app_user and READ ONLY (a write
 *      attempt fails and rolls back);
 *   3. two workspaces cannot see each other's rows.
 *
 * Opt-in: set TEST_DATABASE_URL to a MIGRATED, DISPOSABLE database
 * (Supabase development branch or a local stack with migrations applied —
 * never production). The suite seeds two workspaces and deletes them
 * afterwards, but you should still treat the target as scratch:
 *
 *   $env:TEST_DATABASE_URL = "postgres://..."; `
 *     pnpm -F @cendaro/api exec vitest run `
 *       src/__tests__/integration.workspace-rls.test.ts
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { getDb } from "@cendaro/db/client";
import * as schema from "@cendaro/db/schema";
import { Product, Workspace } from "@cendaro/db/schema";

import { runInWorkspaceRlsReadonly } from "../trpc";

const TEST_URL = process.env.TEST_DATABASE_URL;

const WS_A = "e0000000-0000-4000-8000-00000000000a";
const WS_B = "e0000000-0000-4000-8000-00000000000b";

const sku = (suffix: string) => `F95-INT-${suffix}`;

function rows<T>(result: unknown): T[] {
  const shaped = result as { rows?: T[] } | T[];
  return Array.isArray(shaped) ? shaped : (shaped.rows ?? []);
}

describe.skipIf(!TEST_URL)("F9.5: workspace RLS on a real database", () => {
  let admin: pg.Client | undefined;
  let pool: pg.Pool | undefined;
  let db: ReturnType<typeof getDb> | undefined;

  /** The suite only runs with TEST_DATABASE_URL, so beforeAll has run. */
  function database(): ReturnType<typeof getDb> {
    if (!db) throw new Error("beforeAll did not initialize the database");
    return db;
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: TEST_URL });
    await admin.connect();

    // Sanity: the suite needs the roles and RLS the migrations define.
    const roleOk = await admin.query(
      `SELECT 1 FROM pg_roles WHERE rolname = 'app_user'`,
    );
    expect(
      roleOk.rowCount,
      "app_user role must exist (run the migrations)",
    ).toBe(1);
    const rlsOk = await admin.query(
      `SELECT relrowsecurity AS rls FROM pg_class WHERE relname = 'product'`,
    );
    expect(rlsOk.rows[0]?.rls, "product must have RLS enabled").toBe(true);

    await admin.query("BEGIN");
    await admin.query(
      `INSERT INTO workspace (id, name, slug) VALUES
         ($1, 'F9.5 Integration A', 'f95-int-a'),
         ($2, 'F9.5 Integration B', 'f95-int-b')
       ON CONFLICT (id) DO NOTHING`,
      [WS_A, WS_B],
    );
    await admin.query(
      `INSERT INTO product (id, workspace_id, sku, name) VALUES
         (gen_random_uuid(), $1, $3, 'Producto Alfa'),
         (gen_random_uuid(), $2, $4, 'Producto Beta')
       ON CONFLICT DO NOTHING`,
      [WS_A, WS_B, sku("A"), sku("B")],
    );
    await admin.query("COMMIT");

    pool = new pg.Pool({ connectionString: TEST_URL, max: 2 });
    // Same construction as @cendaro/db's getDb(): schema-typed drizzle over
    // node-postgres, snake_case included — without it Drizzle emits camelCase
    // identifiers the database does not have.
    db = drizzle(pool, { schema, casing: "snake_case" });
  });

  afterAll(async () => {
    if (admin) {
      await admin.query(`DELETE FROM product WHERE workspace_id IN ($1, $2)`, [
        WS_A,
        WS_B,
      ]);
      await admin.query(`DELETE FROM workspace WHERE id IN ($1, $2)`, [
        WS_A,
        WS_B,
      ]);
      await admin.end();
    }
    if (pool) await pool.end();
  });

  it("reads WITHOUT a workspace filter still only see the current workspace (M9)", async () => {
    // This is the exact regression scenario of finding M9: a query whose
    // author forgot the workspace_id WHERE clause. Under postgres it would
    // have leaked every tenant; under app_user + RLS it must return only
    // the current workspace's rows.
    const inA = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx.select({ sku: Product.sku }).from(Product),
    );
    expect(inA.map((r) => r.sku)).toEqual([sku("A")]);

    const inB = await runInWorkspaceRlsReadonly(database(), WS_B, (tx) =>
      tx.select({ sku: Product.sku }).from(Product),
    );
    expect(inB.map((r) => r.sku)).toEqual([sku("B")]);
  });

  it("runs as app_user inside the transaction", async () => {
    const who = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx
        .execute(sql`SELECT current_user`)
        .then((r) => rows<{ current_user: string }>(r)),
    );
    expect(who[0]?.current_user).toBe("app_user");
  });

  it("rejects a write inside the READ ONLY transaction and rolls back", async () => {
    const failure = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx.insert(Product).values({
        workspaceId: WS_A,
        sku: sku("RO"),
        name: "No debe persistir",
      }),
    ).then(
      () => null,
      (error: unknown) => error,
    );

    // Drizzle wraps the driver error ("Failed query: insert ..."); the
    // SQLSTATE lives on the cause. 25006 = read_only_sql_transaction.
    expect(failure).not.toBeNull();
    const cause = (failure as { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe("25006");

    // Nothing leaked through the failed transaction.
    const leftovers = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx
        .select({ id: Product.id })
        .from(Product)
        .where(eq(Product.sku, sku("RO"))),
    );
    expect(leftovers).toEqual([]);
  });

  it("SET LOCAL does not leak past the transaction", async () => {
    await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx.execute(sql`SELECT 1`),
    );

    // A fresh pooled connection must not inherit the role/workspace.
    const leaked = await database().execute(sql`SELECT current_user`);
    const current = rows<{ current_user: string }>(leaked)[0]?.current_user;
    expect(current).not.toBe("app_user");
  });

  it("workspace rows are scoped too: app_user sees only the current workspace", async () => {
    // Migration 004 shipped workspace_app_user_select as USING (true), which
    // let any app_user transaction list every tenant (name, slug, plan,
    // status). Migration 022 scopes it. Every code path that lists
    // workspaces across tenants runs as `postgres`, not app_user.
    const inA = await runInWorkspaceRlsReadonly(database(), WS_A, (tx) =>
      tx.select({ id: Workspace.id }).from(Workspace),
    );
    expect(inA.map((r) => r.id)).toEqual([WS_A]);

    const inB = await runInWorkspaceRlsReadonly(database(), WS_B, (tx) =>
      tx.select({ id: Workspace.id }).from(Workspace),
    );
    expect(inB.map((r) => r.id)).toEqual([WS_B]);
  });
});

/**
 * Structural leak audit — catalog assertions, no seed data needed. A row-level
 * test only proves the tables it seeds; these prove the property for EVERY
 * public table, so a new table or a loosened policy fails here (this is the
 * check that would have caught workspace_app_user_select USING (true)).
 */
describe.skipIf(!TEST_URL)("F9.5: structural tenant-isolation audit", () => {
  let admin: pg.Client | undefined;

  /** Tables whose app_user SELECT policy is deliberately not workspace-keyed. */
  const GLOBAL_CATALOGS = ["permission", "role_permission"];
  /** Functions that app_user may execute although they are SECURITY DEFINER. */
  const APP_USER_DEFINER_FUNCTIONS = [
    "find_active_user_id_by_email",
    "user_membership_count",
  ];

  function adminClient(): pg.Client {
    if (!admin) throw new Error("beforeAll did not connect");
    return admin;
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: TEST_URL });
    await admin.connect();
  });

  afterAll(async () => {
    if (admin) await admin.end();
  });

  it("every public table has RLS enabled", async () => {
    const res = await adminClient().query<{ relname: string }>(
      `SELECT c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND NOT c.relrowsecurity
        ORDER BY c.relname`,
    );
    expect(res.rows.map((r) => r.relname)).toEqual([]);
  });

  it("anon and authenticated (PostgREST roles) hold no table privileges", async () => {
    const res = await adminClient().query<{ relname: string; role: string }>(
      `SELECT c.relname, r.rolname AS role
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         CROSS JOIN (SELECT rolname FROM pg_roles
                      WHERE rolname IN ('anon', 'authenticated')) r
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND has_table_privilege(r.rolname, c.oid,
                'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
        ORDER BY c.relname, r.rolname`,
    );
    expect(res.rows).toEqual([]);
  });

  it("every app_user read policy is scoped to the current workspace", async () => {
    const res = await adminClient().query<{
      tablename: string;
      policyname: string;
      qual: string | null;
    }>(
      `SELECT tablename, policyname, qual
         FROM pg_policies
        WHERE schemaname = 'public'
          AND cmd IN ('SELECT', 'ALL')
          AND roles::text[] && ARRAY['app_user', 'public']`,
    );

    const unscoped = res.rows
      .filter((p) => !GLOBAL_CATALOGS.includes(p.tablename))
      .filter((p) => !(p.qual ?? "").includes("app.workspace_id"))
      .map((p) => `${p.tablename}.${p.policyname}: ${p.qual ?? "(none)"}`);

    expect(unscoped).toEqual([]);

    // The catalogs are deliberately global: fixed role/permission matrix, no
    // tenant data. Pin that they stay exactly that.
    const catalogs = res.rows
      .filter((p) => GLOBAL_CATALOGS.includes(p.tablename))
      .map((p) => p.tablename)
      .sort();
    expect(catalogs).toEqual([...GLOBAL_CATALOGS].sort());
  });

  it("no SECURITY DEFINER function is executable by app_user, anon or authenticated", async () => {
    const res = await adminClient().query<{ proname: string }>(
      `SELECT p.proname
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
          AND (has_function_privilege('app_user', p.oid, 'EXECUTE')
            OR has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
        ORDER BY p.proname`,
    );
    const unexpected = res.rows
      .map((r) => r.proname)
      .filter((name) => !APP_USER_DEFINER_FUNCTIONS.includes(name));
    expect(unexpected).toEqual([]);
  });

  it("infrastructure tables are unreachable for app_user", async () => {
    const res = await adminClient().query<{ relname: string }>(
      `SELECT c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('rate_limit_bucket', 'rate_limit_lockout',
                            'user_session_activity')
          AND has_table_privilege('app_user', c.oid,
                'SELECT, INSERT, UPDATE, DELETE')`,
    );
    expect(res.rows).toEqual([]);
  });
});
