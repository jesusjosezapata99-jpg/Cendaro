/**
 * F9.2 (finding M9) — workspaceReadProcedure executes every `.query()`
 * under `app_user` + RLS in a READ ONLY transaction.
 *
 * Until 2026-09-21 reads ran as `postgres` (BYPASSRLS): isolation depended
 * 100 % on each query remembering its workspace_id filter. These tests pin
 * the three semantics of the fix:
 *   1. a query handler receives the transaction and the setup batch ran
 *      (transaction requested READ ONLY + SET LOCAL ROLE + set_config);
 *   2. a mutation built on the read builder (pricing.syncRates pattern)
 *      still gets the pooled connection — no transaction, no READ ONLY;
 *   3. a non-UUID workspace id can never reach the interpolated batch.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import {
  createCallerFactory,
  createTRPCRouter,
  runInWorkspaceRlsReadonly,
  workspaceReadProcedure,
} from "../trpc";

const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000f92";

function fakeDb() {
  const executed: string[] = [];
  let capturedTxConfig: unknown = null;
  const base = {
    execute: (query: { queryChunks?: unknown[] }) => {
      const first = (query as { queryChunks?: { value?: unknown }[] })
        .queryChunks?.[0]?.value;
      const text =
        typeof first === "string"
          ? first
          : Array.isArray(first)
            ? first.join("")
            : "";
      executed.push(text);
      return Promise.resolve({ rows: [] });
    },
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve([]),
      };
      return chain;
    },
  };
  const pool = {
    ...base,
    transaction: (
      fn: (tx: typeof base) => Promise<unknown>,
      config?: unknown,
    ) => {
      capturedTxConfig = config;
      return fn(base);
    },
  };
  return {
    pool,
    base,
    executed,
    txConfig: () => capturedTxConfig,
  };
}

function membershipDb(executed: string[]) {
  return {
    execute: () => {
      executed.push("is_workspace_member");
      return Promise.resolve({
        rows: [
          {
            member_id: "m0000000-0000-0000-0000-000000000001",
            member_role: "employee",
            member_status: "active",
          },
        ],
      });
    },
    select: (shape: Record<string, unknown>) => {
      const rows =
        "plan" in shape ? [{ plan: "starter" }] : [{ fullName: "QA" }];
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(rows),
      };
      return chain;
    },
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };
}

describe("F9.2: reads run under RLS as app_user", () => {
  const router = createTRPCRouter({
    readIt: workspaceReadProcedure.query(({ ctx }) => ctx.db),
    writeOnReadBuilder: workspaceReadProcedure.mutation(({ ctx }) => ({
      ok: true,
      sawTransaction:
        typeof (ctx.db as { transaction?: unknown }).transaction === "function",
    })),
  });
  const createCaller = createCallerFactory(router);

  it("a .query() handler runs inside the READ ONLY app_user transaction", async () => {
    const { pool, base, executed, txConfig } = fakeDb();
    const membership = membershipDb(executed);
    // resolveWorkspaceMembership uses ctx.db; the wrapper then opens the
    // transaction on the same object.
    const dbWithMembership = { ...membership, transaction: pool.transaction };

    const caller = createCaller({
      user: {
        id: "a0000000-0000-0000-0000-000000000001",
        email: "qa@example.com",
      },
      db: dbWithMembership as never,
      requestId: "req-f92",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-f92" }),
      workspaceId: WORKSPACE_ID,
    });

    // The handler saw the transaction object (the `tx` the driver created),
    // not the pooled db.
    await expect(caller.readIt()).resolves.toBe(base);

    // drizzle folds the mode into BEGIN itself (`begin read only`) — the
    // transaction must be requested READ ONLY, not read-write.
    expect(txConfig()).toEqual({ accessMode: "read only" });
    // Role and workspace are bound in ONE statement, as on the write path.
    const bind = executed.filter((q) =>
      q.includes("set_config('role', 'app_user', true)"),
    );
    expect(bind).toHaveLength(1);
    expect(bind[0]).toContain("set_config('app.workspace_id'");
  });

  it("a .mutation() on the read builder keeps the pooled connection", async () => {
    const executed: string[] = [];
    const pool = membershipDb(executed);

    const caller = createCaller({
      user: {
        id: "a0000000-0000-0000-0000-000000000002",
        email: "qa@example.com",
      },
      db: pool as never,
      requestId: "req-f92",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-f92" }),
      workspaceId: WORKSPACE_ID,
    });

    await expect(caller.writeOnReadBuilder()).resolves.toEqual({
      ok: true,
      sawTransaction: true,
    });
    // No READ ONLY batch for the documented syncRates-style escape hatch.
    expect(executed.some((q) => q.includes("SET TRANSACTION READ ONLY"))).toBe(
      false,
    );
  });

  it("runInWorkspaceRlsReadonly rejects a non-UUID workspace id before any SQL", () => {
    const { pool, executed } = fakeDb();

    // The guard throws synchronously, before the driver transaction is even
    // opened — which is exactly what keeps the raw interpolation safe.
    expect(() =>
      runInWorkspaceRlsReadonly(pool as never, "'; DROP TABLE users; --", () =>
        Promise.resolve(1),
      ),
    ).toThrow(TRPCError);

    expect(executed).toHaveLength(0);
  });
});
