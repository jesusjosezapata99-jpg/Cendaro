/**
 * MFA enforcement and idle-session timeout at the tRPC layer
 * (PLAN-2026-09-SECURITY-REMEDIATION F7, findings M2/M8).
 *
 *  - F7.1: `protectedProcedure` verifies `user_session_activity` for every
 *    authenticated call — including reads — so a token idle past 30 minutes
 *    is rejected even when it never goes through a page navigation (the old
 *    cookie-based check in proxy.ts never saw /api/trpc at all).
 *  - F7.2: `workspaceProcedure` (mutations) blocks an owner/admin session
 *    without aal2 once MFA_ENFORCEMENT_DATE has passed; `workspaceReadProcedure`
 *    (reads) is deliberately left open so a blocked owner can still reach
 *    /settings/security to enroll.
 */
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import { usersRouter } from "../modules/users";
import { workspaceRouter } from "../modules/workspace";
import { MFA_ENFORCEMENT_DATE } from "../services/mfa-enforcement";
import {
  createCallerFactory,
  createTRPCRouter,
  MfaRequiredError,
} from "../trpc";

const WORKSPACE = "00000000-0000-4000-8000-0000000000e1";
const TARGET = "00000000-0000-4000-8000-0000000000e2";
const MEMBER_ROW = "00000000-0000-4000-8000-0000000000e3";
const SESSION = "00000000-0000-4000-8000-0000000000e4";

const dialect = new PgDialect({ casing: "snake_case" });

type Row = Record<string, unknown>;

interface Options {
  role?: string;
  aal?: "aal1" | "aal2" | null;
  /** Row returned for user_session_activity's SELECT; undefined = no row (new session). */
  lastSeenAt?: Date;
  tableRows?: Record<string, Row[]>;
}

function fakeDb(opts: Options) {
  const executed: string[] = [];

  const chain = (table: string) => {
    const self: Record<string, unknown> = {};
    for (const m of [
      "where",
      "limit",
      "for",
      "orderBy",
      "innerJoin",
      "set",
      "values",
      "returning",
    ]) {
      self[m] = () => self;
    }
    self.then = (ok: (rows: unknown[]) => unknown) =>
      Promise.resolve(opts.tableRows?.[table] ?? []).then(ok);
    return self;
  };

  const select = () => {
    const self: Record<string, unknown> = {};
    self.from = (t: unknown) => chain(getTableConfig(t as never).name);
    return self;
  };
  // Drizzle's update/insert chains start directly from the table, unlike
  // select's .from(table) — db.update(Table).set(...).where(...).
  const writeOp = (t: unknown) => chain(getTableConfig(t as never).name);

  const execute = (query: SQL) => {
    const text = dialect.sqlToQuery(query).sql;
    executed.push(text);
    if (text.includes("is_workspace_member")) {
      return Promise.resolve({
        rows: [
          {
            member_id: MEMBER_ROW,
            member_role: opts.role ?? "owner",
            member_status: "active",
          },
        ],
      });
    }
    if (
      text.includes("user_session_activity") &&
      text.toLowerCase().startsWith("select")
    ) {
      return Promise.resolve({
        rows: opts.lastSeenAt
          ? [{ last_seen_at: opts.lastSeenAt.toISOString() }]
          : [],
      });
    }
    return Promise.resolve({ rows: [] });
  };

  const base = { execute, select, update: writeOp, insert: writeOp };
  const db = {
    ...base,
    transaction: (fn: (tx: typeof base) => Promise<unknown>) => fn(base),
  };
  return { db, executed };
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
  const caller = createCaller({
    user: {
      id: nextCallerId(),
      email: "actor@example.com",
      aal: opts.aal ?? null,
      sessionId: SESSION,
    },
    db: fake.db as never,
    requestId: "req-f7",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: false,
    log: logger.child({ requestId: "req-f7" }),
    workspaceId: WORKSPACE,
  });
  return { caller, ...fake };
}

describe("idle-session timeout (F7.1)", () => {
  it("allows a brand new session", async () => {
    const { caller } = callerFor({ role: "employee" });
    await expect(caller.users.me()).resolves.toBeDefined();
  });

  it("allows a session seen 5 minutes ago", async () => {
    const { caller } = callerFor({
      role: "employee",
      lastSeenAt: new Date(Date.now() - 5 * 60_000),
    });
    await expect(caller.users.me()).resolves.toBeDefined();
  });

  it("rejects a session idle for more than 30 minutes", async () => {
    const { caller } = callerFor({
      role: "employee",
      lastSeenAt: new Date(Date.now() - 31 * 60_000),
    });
    await expect(caller.users.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("checks activity once per request and reuses it across a batch", async () => {
    const { caller, executed } = callerFor({ role: "employee" });

    await caller.users.me();
    await caller.users.me();

    const selects = executed.filter(
      (s) =>
        s.includes("user_session_activity") &&
        s.toLowerCase().startsWith("select"),
    );
    expect(selects).toHaveLength(1);
  });
});

describe("MFA enforcement (F7.2)", () => {
  it("blocks a mutation from an owner without aal2 once the grace period ends", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MFA_ENFORCEMENT_DATE.getTime() + 1));
    try {
      const { caller } = callerFor({
        role: "owner",
        aal: "aal1",
        tableRows: {
          workspace_member: [{ role: "employee", status: "active" }],
        },
      });

      await expect(
        caller.users.update({ id: TARGET, fullName: "Nuevo" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws the distinguishable MfaRequiredError, not a plain FORBIDDEN", async () => {
    // The direct in-process caller used by tests (and by other server code)
    // propagates the thrown error as-is; it is the fetch adapter that later
    // runs it through errorFormatter to add `data.mfaRequired` for the
    // browser client — a one-line `instanceof` check there, so what matters
    // here is that the *right class* is thrown for it to detect.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MFA_ENFORCEMENT_DATE.getTime() + 1));
    try {
      const { caller } = callerFor({
        role: "admin",
        aal: null,
        tableRows: {
          workspace_member: [{ role: "employee", status: "active" }],
        },
      });

      const error = await caller.users
        .update({ id: TARGET, fullName: "Nuevo" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(MfaRequiredError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not block during the grace period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MFA_ENFORCEMENT_DATE.getTime() - 1));
    try {
      const { caller } = callerFor({
        role: "owner",
        aal: null,
        tableRows: {
          workspace_member: [{ role: "employee", status: "active" }],
        },
      });

      await expect(
        caller.users.update({ id: TARGET, fullName: "Nuevo" }),
      ).resolves.toMatchObject({ id: TARGET });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never blocks a session already verified with aal2", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MFA_ENFORCEMENT_DATE.getTime() + 1));
    try {
      const { caller } = callerFor({
        role: "owner",
        aal: "aal2",
        tableRows: {
          workspace_member: [{ role: "employee", status: "active" }],
        },
      });

      await expect(
        caller.users.update({ id: TARGET, fullName: "Nuevo" }),
      ).resolves.toMatchObject({ id: TARGET });
    } finally {
      vi.useRealTimers();
    }
  });

  // Coverage for roles outside owner/admin never being required/blocked lives
  // in mfa-enforcement.test.ts (the pure decision `mfaComplianceFor` both this
  // gate and the UI banner read); no workspaceProcedure mutation here is open
  // to a role that isn't owner/admin/supervisor, so re-proving it end-to-end
  // would just retest the same role matrix covered by procedure-authz-*.

  it("leaves reads open for a blocked owner, so they can reach the enrollment page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MFA_ENFORCEMENT_DATE.getTime() + 1));
    try {
      const { caller } = callerFor({
        role: "owner",
        aal: null,
        tableRows: {
          workspace: [{ id: WORKSPACE, name: "Acme" }],
          workspace_module: [],
          workspace_quota: [{ workspaceId: WORKSPACE }],
        },
      });

      await expect(caller.workspace.current()).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
