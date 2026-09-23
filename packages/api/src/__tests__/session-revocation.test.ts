/**
 * Effective revocation (PLAN-2026-09-SECURITY-REMEDIATION F5, finding H5).
 *
 *  - Suspending or removing someone queues a session revocation that runs
 *    AFTER the transaction commits, as `postgres`: inside it the statements
 *    would run as `app_user`, which has no rights on the `auth` schema, and
 *    the new status would not be committed yet.
 *  - Membership is resolved once per request and never cached beyond it, so a
 *    revoked member is locked out on their next request on every instance
 *    instead of waiting out a 60 s TTL.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import { usersRouter } from "../modules/users";
import { workspaceRouter } from "../modules/workspace";
import { createCallerFactory, createTRPCRouter } from "../trpc";

const WORKSPACE = "00000000-0000-4000-8000-0000000000f1";
const TARGET = "00000000-0000-4000-8000-0000000000f9";
const CALLER_MEMBER_ROW = "00000000-0000-4000-8000-0000000000fa";
const MEMBER_ROW = "00000000-0000-4000-8000-0000000000fb";

const dialect = new PgDialect({ casing: "snake_case" });

type Row = Record<string, unknown>;

interface Options {
  /** Row returned for the member being edited or removed. */
  target: Row;
  /** Whether the person still has access somewhere after the change. */
  keepsAccess?: boolean;
}

function fakeDb(opts: Options) {
  const executed: string[] = [];
  const membershipLookups: string[] = [];

  const chain = () => {
    const self: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "for", "orderBy", "innerJoin"]) {
      self[m] = () => self;
    }
    self.then = (ok: (rows: unknown[]) => unknown) =>
      Promise.resolve([opts.target]).then(ok);
    return self;
  };

  const writeChain = () => {
    const self: Record<string, unknown> = {};
    for (const m of ["set", "values", "where", "returning"]) {
      self[m] = () => self;
    }
    self.then = (ok: (rows: unknown[]) => unknown) =>
      Promise.resolve([{ id: TARGET }]).then(ok);
    return self;
  };

  const execute = (query: SQL) => {
    const text = dialect.sqlToQuery(query).sql;
    executed.push(text);
    if (text.includes("is_workspace_member")) {
      membershipLookups.push(text);
      return Promise.resolve({
        rows: [
          {
            member_id: CALLER_MEMBER_ROW,
            member_role: "owner",
            member_status: "active",
          },
        ],
      });
    }
    if (text.includes("user_membership_count")) {
      return Promise.resolve({ rows: [{ memberships: 1 }] });
    }
    // hasActiveAccess: rows present mean the person still has access.
    if (text.includes("workspace_member m")) {
      return Promise.resolve({ rows: opts.keepsAccess ? [{ ok: 1 }] : [] });
    }
    return Promise.resolve({ rows: [] });
  };

  const base = {
    execute,
    select: () => chain(),
    update: () => writeChain(),
    insert: () => writeChain(),
  };
  const db = {
    ...base,
    transaction: (fn: (tx: typeof base) => Promise<unknown>) => fn(base),
  };
  return { db, executed, membershipLookups };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ users: usersRouter, workspace: workspaceRouter }),
);

let callerCounter = 0;
function nextCallerId(): string {
  callerCounter += 1;
  return `00000000-0000-4000-8000-${String(callerCounter).padStart(12, "0")}`;
}

function callerFor(opts: Options) {
  const fake = fakeDb(opts);
  const afterCommit: ((db: never) => Promise<unknown>)[] = [];
  const membershipCache = new Map();
  const caller = createCaller({
    user: { id: nextCallerId(), email: "owner@example.com" },
    db: fake.db as never,
    requestId: "req-revocation",
    membershipCache,
    afterCommit: afterCommit as never,
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-revocation" }),
    workspaceId: WORKSPACE,
  });
  return { caller, afterCommit, membershipCache, ...fake };
}

const deletesAuthRows = (statements: string[]): string[] =>
  statements.filter((s) => /delete\s+from\s+auth\./i.test(s));

describe("session revocation", () => {
  it("revokes the sessions of a suspended member after the commit", async () => {
    const { caller, executed } = callerFor({
      target: { role: "employee", status: "active" },
    });

    await caller.users.update({ id: TARGET, status: "suspended" });

    // sessions + any refresh token left without one
    expect(deletesAuthRows(executed)).toHaveLength(2);
  });

  it("keeps the sessions when the member still has access elsewhere", async () => {
    const { caller, executed } = callerFor({
      target: { role: "employee", status: "active" },
      keepsAccess: true,
    });

    await caller.users.update({ id: TARGET, status: "suspended" });

    expect(deletesAuthRows(executed)).toHaveLength(0);
  });

  it("does not revoke anything when only the name changes", async () => {
    const { caller, executed } = callerFor({
      target: { role: "employee", status: "active" },
    });

    await caller.users.update({ id: TARGET, fullName: "Nuevo Nombre" });

    expect(deletesAuthRows(executed)).toHaveLength(0);
  });

  it("revokes the sessions of a removed member", async () => {
    const { caller, executed } = callerFor({
      target: { id: MEMBER_ROW, userId: TARGET, role: "employee" },
    });

    await caller.workspace.removeMember({ memberId: MEMBER_ROW });

    expect(
      executed.some((s) => /delete\s+from\s+auth\.sessions/i.test(s)),
    ).toBe(true);
  });

  it("lets the mutation succeed even if the revocation fails", async () => {
    const { caller, db } = callerFor({
      target: { role: "employee", status: "active" },
    });
    const execute = db.execute.bind(db) as (query: SQL) => Promise<unknown>;
    vi.spyOn(db, "execute").mockImplementation(((query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      const isRevocation =
        /delete\s+from\s+auth\./i.test(text) ||
        text.includes("workspace_member m");
      return isRevocation
        ? Promise.reject(new Error("auth schema unreachable"))
        : execute(query);
    }) as never);

    await expect(
      caller.users.update({ id: TARGET, status: "suspended" }),
    ).resolves.toMatchObject({ id: TARGET });
  });
});

describe("membership resolution", () => {
  it("reads is_workspace_member once per request and shares it in the batch", async () => {
    const { caller, membershipLookups } = callerFor({
      target: { role: "employee", status: "active" },
    });

    await caller.users.update({ id: TARGET, fullName: "Uno" });
    await caller.users.update({ id: TARGET, fullName: "Dos" });

    expect(membershipLookups).toHaveLength(1);
  });

  it("re-reads it for the next request, so a revoked role never survives", async () => {
    const first = callerFor({ target: { role: "employee", status: "active" } });
    const second = callerFor({
      target: { role: "employee", status: "active" },
    });

    await first.caller.users.update({ id: TARGET, fullName: "Uno" });
    await second.caller.users.update({ id: TARGET, fullName: "Dos" });

    expect(first.membershipLookups).toHaveLength(1);
    expect(second.membershipLookups).toHaveLength(1);
  });
});
