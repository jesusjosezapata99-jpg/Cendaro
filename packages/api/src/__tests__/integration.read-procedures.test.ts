/**
 * F9.2 / F9.5 — every tRPC read procedure against a REAL migrated database.
 *
 * F9.2 moved every `.query()` onto `app_user` inside a READ ONLY transaction.
 * Unit tests mock the database, so they cannot see the failures that matter
 * for that change: a table `app_user` cannot read (42501), a read handler that
 * writes (25006), a column the schema still names but the database dropped
 * (42703), a missing relation (42P01). This suite calls each read procedure
 * through the real router and driver and fails on exactly those.
 *
 * It only READS. It discovers an active owner membership in the target
 * database (no seeding), so run it against a database that already has one.
 * Each procedure is called with the smallest input its Zod schema accepts
 * (required fields only; ids that match no row answer NOT_FOUND or empty,
 * which still runs the SQL). Input validation (BAD_REQUEST) is counted as
 * "needs-input", not as a pass for the SQL path — the summary reports how many
 * procedures were actually exercised so a shrinking number is visible.
 *
 * Opt-in like the other integration suite:
 *   $env:TEST_DATABASE_URL = "postgres://..."  (also set DATABASE_URL to it)
 *   pnpm -F @cendaro/api test:integration
 */
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { getDb } from "@cendaro/db/client";
import * as schema from "@cendaro/db/schema";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";
import { sampleInput } from "./helpers/sample-input";

const TEST_URL = process.env.TEST_DATABASE_URL;

type Db = ReturnType<typeof getDb>;
type AnyCaller = Record<string, unknown>;

interface Outcome {
  path: string;
  status: "ok" | "needs-input" | "gated" | "failed";
  detail?: string;
}

/** Postgres error text that means F9.2 broke a read. */
const PG_BREAKAGE =
  /permission denied|read-only|does not exist|42501|25006|42703|42P01/i;

interface ErrorLike {
  cause?: unknown;
  message?: string;
  code?: string;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === "object" && value !== null;
}

/** Deepest error in the cause chain: Drizzle wraps the driver's error. */
function rootCause(error: unknown): ErrorLike {
  let current: ErrorLike = isErrorLike(error)
    ? error
    : { message: String(error) };
  while (isErrorLike(current.cause)) current = current.cause;
  return current;
}

function describeError(error: unknown): string {
  const root = rootCause(error);
  const label = error instanceof TRPCError ? `${error.code}: ` : "";
  return `${label}${root.code ?? ""} ${root.message ?? String(error)}`.trim();
}

function callProcedure(
  caller: AnyCaller,
  path: string,
  input: unknown,
): Promise<unknown> {
  const fn = path
    .split(".")
    .reduce<unknown>((node, key) => (node as AnyCaller)[key], caller);
  return (fn as (input: unknown) => Promise<unknown>)(input);
}

describe.skipIf(!TEST_URL)(
  "F9.2: every read procedure on a real database",
  () => {
    let pool: pg.Pool | undefined;
    let db: Db | undefined;
    let owner: { userId: string; workspaceId: string } | undefined;
    const outcomes: Outcome[] = [];

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: TEST_URL, max: 2 });
      // Must match getDb() in @cendaro/db/client, casing included: without
      // snake_case Drizzle emits "fullName"-style identifiers the database
      // does not have, and every query fails for a reason unrelated to F9.2.
      db = drizzle(pool, { schema, casing: "snake_case" });

      const found = await pool.query<{
        user_id: string;
        workspace_id: string;
      }>(
        `SELECT m.user_id, m.workspace_id
         FROM workspace_member m
         JOIN user_profile p ON p.id = m.user_id AND p.status = 'active'
         JOIN workspace w ON w.id = m.workspace_id AND w.status = 'active'
        WHERE m.status = 'active' AND m.role = 'owner'
        LIMIT 1`,
      );
      const row = found.rows[0];
      if (row) owner = { userId: row.user_id, workspaceId: row.workspace_id };
    });

    afterAll(async () => {
      if (pool) await pool.end();
    });

    it("finds an active owner to act as", () => {
      expect(
        owner,
        "the target database needs an active owner membership",
      ).toBeDefined();
    });

    // 80+ sequential round trips to a remote database: well past the 10 s
    // default, and a timeout here would let afterAll close the pool while the
    // loop is still running.
    it(
      "no read procedure fails on permissions, read-only, or schema drift",
      {
        timeout: 180_000,
      },
      async () => {
        if (!db || !owner) throw new Error("beforeAll did not initialize");

        const createCaller = createCallerFactory(appRouter);
        const caller = createCaller({
          user: {
            id: owner.userId,
            email: "integration@example.invalid",
            aal: "aal2",
            sessionId: null,
          },
          db,
          requestId: "req-f92-integration",
          membershipCache: new Map(),
          afterCommit: [],
          sessionActivityChecked: true,
          log: logger.child({ requestId: "req-f92-integration" }),
          workspaceId: owner.workspaceId,
        }) as unknown as AnyCaller;

        const procedures = Object.entries(
          appRouter._def.procedures as unknown as Record<
            string,
            { _def: { type: string; inputs?: unknown[] } }
          >,
        ).filter(([, procedure]) => procedure._def.type === "query");

        expect(procedures.length).toBeGreaterThan(30);

        for (const [path, procedure] of procedures) {
          try {
            await callProcedure(caller, path, sampleInput(procedure));
            outcomes.push({ path, status: "ok" });
          } catch (error) {
            const detail = describeError(error);
            if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
              outcomes.push({ path, status: "needs-input", detail });
            } else if (
              error instanceof TRPCError &&
              ["FORBIDDEN", "NOT_FOUND"].includes(error.code) &&
              !PG_BREAKAGE.test(detail)
            ) {
              // Plan gating or an empty record: legitimate answers, not breakage.
              outcomes.push({ path, status: "gated", detail });
            } else {
              outcomes.push({ path, status: "failed", detail });
            }
          }
        }

        const count = (status: Outcome["status"]) =>
          outcomes.filter((o) => o.status === status).length;
        // Visible in the test output so coverage of the SQL paths is auditable.
        console.info(
          `[F9.2 read-procedure smoke] total=${outcomes.length} ok=${count("ok")} ` +
            `needs-input=${count("needs-input")} gated=${count("gated")} ` +
            `failed=${count("failed")}`,
        );
        for (const o of outcomes.filter((x) => x.status !== "ok")) {
          console.info(`  ${o.status.padEnd(11)} ${o.path} ${o.detail ?? ""}`);
        }

        const failed = outcomes
          .filter((o) => o.status === "failed")
          .map((o) => `${o.path} -> ${o.detail}`);
        expect(failed).toEqual([]);
      },
    );

    it("exercised the SQL of a meaningful share of the read procedures", () => {
      const exercised = outcomes.filter(
        (o) => o.status === "ok" || o.status === "gated",
      ).length;
      // A floor, not a target: if this shrinks the smoke test is silently
      // covering less of the read surface than it used to. Measured
      // 2026-09-21: 81 of 81 (79 ok + 2 legitimate NOT_FOUND).
      expect(exercised).toBeGreaterThanOrEqual(
        Math.floor(outcomes.length * 0.9),
      );
    });
  },
);
