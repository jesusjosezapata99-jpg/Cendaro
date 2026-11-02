/**
 * The role behind the daily production checks reads the invariants across every
 * workspace and nothing personal.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.monitor-role.test.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { QueryResult } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

const INVARIANTS = readFileSync(
  path.resolve(
    __dirname,
    "../../../../scripts/checks/prod/financial-invariants.sql",
  ),
  "utf8",
);

describe.skipIf(!TEST_URL)("monitor_reader", () => {
  let real: RealDb;
  let fx: Fixture;

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
  });

  afterAll(async () => {
    await real.pool.end();
  });

  const asMonitor = async (
    run: (query: (text: string) => Promise<QueryResult>) => Promise<void>,
  ): Promise<void> => {
    const client = await real.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE monitor_reader");
      await run((text) => client.query(text));
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  };

  it("cannot log in until someone sets its password", async () => {
    const { rows } = await real.pool.query<{ rolcanlogin: boolean }>(
      `SELECT rolcanlogin FROM pg_roles WHERE rolname = 'monitor_reader'`,
    );

    expect(rows).toEqual([{ rolcanlogin: false }]);
  });

  it("runs the invariants and sees rows of every workspace", async () => {
    await asMonitor(async (query) => {
      const { rows } = await query(INVARIANTS);
      expect(rows.length).toBeGreaterThan(5);

      const seen = await query(
        `SELECT count(*)::int AS total FROM customer
         WHERE workspace_id = '${fx.workspaceId}'`,
      );
      expect(seen.rows[0]?.total).toBeGreaterThan(0);
    });
  });

  it.each([
    "SELECT name FROM customer",
    "SELECT identification FROM customer",
    "SELECT phone FROM customer",
    "SELECT email FROM user_profile",
    "SELECT new_value FROM audit_log",
    "SELECT buyer_rif FROM fiscal_document",
    "UPDATE customer SET balance = 0",
    "DELETE FROM payment",
  ])("refuses %s", async (text) => {
    await asMonitor(async (query) => {
      await expect(query(text)).rejects.toThrow(/permission denied/);
    });
  });
});
