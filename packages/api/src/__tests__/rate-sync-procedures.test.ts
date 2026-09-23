/**
 * Exchange rates and approvals (PLAN-2026-09-SECURITY-REMEDIATION F4.1, F4.4).
 *
 *  - pricing.setRate trusted a rate and a `source` string sent by the browser.
 *    pricing.syncRates fetches the rates on the server; the client only asks
 *    for a refresh, so it cannot choose the value.
 *  - A jump beyond ±15 % is held as an approval + alert instead of repricing.
 *  - approvals: requests are locked while resolved and only resolved while
 *    pending and unexpired; the requester's reason is never overwritten;
 *    `exchange_rate` requests are reserved to the sync.
 */
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceActor } from "../trpc";
import { logger } from "../logger";
import { approvalsRouter } from "../modules/approvals";
import { pricingRouter } from "../modules/pricing";
import { syncAutomaticRates } from "../modules/rate-sync";
import { createCallerFactory, createTRPCRouter } from "../trpc";

const sources = vi.hoisted(() => ({
  getVesRates: vi.fn(),
  getUsdCnyRate: vi.fn(),
}));
vi.mock("../services/exchange-rate-sources", () => sources);

const WORKSPACE = "00000000-0000-4000-8000-0000000000a1";
const CALLER = "00000000-0000-4000-8000-0000000000a2";
const OTHER = "00000000-0000-4000-8000-0000000000a3";
const APPROVAL = "00000000-0000-4000-8000-0000000000a4";
const RATE_ROW = "00000000-0000-4000-8000-0000000000a5";
const NOW = new Date("2026-09-19T15:00:00Z");

type Row = Record<string, unknown>;

interface Write {
  op: "insert" | "update";
  table: string;
  values: Row | Row[];
  where: string;
  params: unknown[];
}

interface Scenario {
  role?: string;
  latestRate?: { rate: number; createdAt: Date } | null;
  /** Latest rate older than 24 h; defaults to `latestRate`. */
  anchorRate?: { rate: number; createdAt: Date } | null;
  heldApprovals?: Row[];
  /** Approval returned when approve/reject load one. */
  approval?: Row | null;
  /** Rate stored after the approval was requested. */
  newerRate?: boolean;
}

// Same casing as the real client, so rendered SQL matches production.
const dialect = new PgDialect({ casing: "snake_case" });

function fakeDb(s: Scenario) {
  const writes: Write[] = [];
  const selects: {
    table: string;
    where: string;
    params: unknown[];
    locked: boolean;
  }[] = [];
  const executed: string[] = [];
  /** Advisory locks and row reads in the order they ran. */
  const events: string[] = [];

  const selectRows = (table: string, shape: Row, where: string): Row[] => {
    switch (table) {
      case "user_profile":
        return [{ fullName: "Caller" }];
      case "workspace":
        return [{ plan: "pro" }];
      case "workspace_module":
        return [{ id: "module" }];
      case "exchange_rate":
        if ("rate" in shape) {
          const anchor = where.includes('"created_at" <');
          const row =
            anchor && s.anchorRate !== undefined ? s.anchorRate : s.latestRate;
          return row ? [row] : [];
        }
        return s.newerRate ? [{ id: "newer" }] : [];
      case "approval":
        if ("resolvedAt" in shape && !("requestedBy" in shape)) {
          return s.heldApprovals ?? [];
        }
        return s.approval ? [s.approval] : [];
      default:
        return [];
    }
  };

  const chain = (op: "select" | "insert" | "update", shape: Row = {}) => {
    let table = "";
    let where = "";
    let params: unknown[] = [];
    let locked = false;
    let values: Row | Row[] = {};
    const self: Record<string, unknown> = {};
    for (const method of ["orderBy", "limit", "returning", "groupBy"]) {
      self[method] = () => self;
    }
    self.from = (t: unknown) => {
      table = getTableConfig(t as never).name;
      return self;
    };
    self.for = () => {
      locked = true;
      return self;
    };
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        where = rendered.sql;
        params = rendered.params;
      }
      return self;
    };
    self.values = (v: Row | Row[]) => {
      values = v;
      return self;
    };
    self.set = (v: Row) => {
      values = v;
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      if (op === "select") {
        selects.push({ table, where, params, locked });
        events.push(`select:${table}${locked ? ":for-update" : ""}`);
        return Promise.resolve(selectRows(table, shape, where)).then(
          onFulfilled,
          onRejected,
        );
      }
      writes.push({ op, table, values, where, params });
      const single = Array.isArray(values) ? {} : values;
      const rows =
        op === "update" && table === "approval" && "status" in single
          ? s.approval
            ? [{ ...s.approval, ...single }]
            : (s.heldApprovals ?? []).map((a) => ({ id: a.id }))
          : [{ id: `${table}-new`, ...single }];
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    };
    return self;
  };

  const target = (op: "insert" | "update") => (t: unknown) => {
    const c = chain(op);
    (c.from as (t: unknown) => unknown)(t);
    return c;
  };

  const base = {
    execute: (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      executed.push(text);
      if (text.includes("pg_advisory_xact_lock")) events.push("advisory-lock");
      if (text.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: [
            {
              member_id: "member",
              member_role: s.role ?? "admin",
              member_status: "active",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
    select: (shape?: Row) => chain("select", shape ?? {}),
    insert: target("insert"),
    update: target("update"),
  };
  const db = {
    ...base,
    transaction: (fn: (tx: typeof base) => Promise<unknown>) => fn(base),
  };
  return { db, writes, selects, executed, events };
}

function written(writes: Write[], table: string, op = "insert"): Write[] {
  return writes.filter((w) => w.table === table && w.op === op);
}

const actor: WorkspaceActor = {
  id: CALLER,
  email: "admin@example.com",
  workspaceRole: "admin",
  displayName: "Admin",
};

const bcv = (rate: number) => ({
  rateType: "bcv" as const,
  rate,
  provider: "bcv-direct",
  valueDate: "2026-09-19",
});

describe("syncAutomaticRates", () => {
  it("stores a normal rate with a server-built source", async () => {
    const { db, writes, executed } = fakeDb({
      latestRate: { rate: 840, createdAt: new Date("2026-09-18T20:00:00Z") },
    });

    const [result] = await syncAutomaticRates(
      db as never,
      actor,
      WORKSPACE,
      [bcv(846.5)],
      NOW,
    );

    expect(result).toMatchObject({ rateType: "bcv", status: "inserted" });
    expect(written(writes, "exchange_rate")[0]?.values).toMatchObject({
      workspaceId: WORKSPACE,
      rateType: "bcv",
      rate: 846.5,
      source: "bcv-direct (auto-sync 2026-09-19)",
      updatedBy: CALLER,
    });
    expect(executed.some((q) => q.includes("pg_advisory_xact_lock"))).toBe(
      true,
    );
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "rate.sync",
    });
    // A stored rate closes the alerts a scheduled run opened for its type.
    const dismissed = written(writes, "system_alert", "update")[0];
    expect(dismissed?.values).toMatchObject({ isDismissed: true });
    expect(dismissed?.params).toContain("Tasa BCV retenida");
  });

  it("holds small steps that add up to more than 15 % within a day", async () => {
    // Three +10 % syncs in a row: each step is under the threshold, but the
    // third one is 21 % above the rate from more than 24 h ago.
    const { db, writes, selects } = fakeDb({
      latestRate: { rate: 880, createdAt: new Date("2026-09-19T08:00:00Z") },
      anchorRate: { rate: 800, createdAt: new Date("2026-09-18T08:00:00Z") },
      heldApprovals: [],
    });

    const [result] = await syncAutomaticRates(
      db as never,
      actor,
      WORKSPACE,
      [bcv(968)],
      NOW,
    );

    expect(result).toMatchObject({ status: "held", variationPct: 21 });
    expect(written(writes, "exchange_rate")).toEqual([]);
    const anchorQuery = selects.find(
      (q) => q.table === "exchange_rate" && q.where.includes('"created_at" <'),
    );
    expect(anchorQuery?.params).toContain(
      new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("does not write the same value twice in a day", async () => {
    const { db, writes } = fakeDb({
      latestRate: { rate: 846.5, createdAt: new Date("2026-09-19T09:00:00Z") },
    });

    const [result] = await syncAutomaticRates(
      db as never,
      actor,
      WORKSPACE,
      [bcv(846.5)],
      NOW,
    );

    expect(result?.status).toBe("unchanged");
    expect(writes).toEqual([]);
  });

  it("holds a jump beyond 15 % as an approval with an alert", async () => {
    const { db, writes } = fakeDb({
      latestRate: { rate: 800, createdAt: new Date("2026-09-18T20:00:00Z") },
      heldApprovals: [],
    });

    const [result] = await syncAutomaticRates(
      db as never,
      actor,
      WORKSPACE,
      [bcv(960)],
      NOW,
    );

    expect(result).toMatchObject({ status: "held", variationPct: 20 });
    expect(written(writes, "exchange_rate")).toEqual([]);
    const approval = written(writes, "approval")[0]?.values as Row;
    expect(approval).toMatchObject({
      approvalType: "price_change",
      entityType: "exchange_rate",
      requestedBy: CALLER,
      metadata: {
        origin: "rate-sync",
        rateType: "bcv",
        rate: 960,
        previousRate: 800,
        variationPct: 20,
      },
    });
    expect((approval.expiresAt as Date).getTime()).toBe(
      NOW.getTime() + 24 * 60 * 60 * 1000,
    );
    expect(written(writes, "system_alert")[0]?.values).toMatchObject({
      alertType: "rate_change",
      entityType: "approval",
      severity: "high",
    });
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "rate.hold",
    });
  });

  it("only alerts when the scheduled job holds a rate", async () => {
    const { db, writes } = fakeDb({
      latestRate: { rate: 800, createdAt: new Date("2026-09-18T20:00:00Z") },
      heldApprovals: [],
    });

    const [result] = await syncAutomaticRates(
      db as never,
      null,
      WORKSPACE,
      [bcv(960)],
      NOW,
    );

    expect(result).toMatchObject({ status: "held", approvalId: null });
    expect(written(writes, "approval")).toEqual([]);
    expect(written(writes, "system_alert")[0]?.values).toMatchObject({
      entityType: "exchange_rate",
      entityId: null,
    });
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      actorName: "system",
    });
  });
});

const createCaller = createCallerFactory(
  createTRPCRouter({ pricing: pricingRouter, approvals: approvalsRouter }),
);

let userCounter = 0;

/** Fresh ids keep the process-wide membership cache (60 s) out of the way. */
function uniqueUser(): string {
  userCounter += 1;
  return `00000000-0000-4000-8000-${String(1000 + userCounter).padStart(12, "0")}`;
}

function callerFor(s: Scenario, userId: string = uniqueUser()) {
  const fake = fakeDb(s);
  const caller = createCaller({
    user: { id: userId, email: "caller@example.com" },
    db: fake.db as never,
    requestId: "req-rates",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-rates" }),
    workspaceId: WORKSPACE,
  });
  return { caller, ...fake };
}

describe("pricing.syncRates", () => {
  beforeEach(() => {
    sources.getVesRates.mockReset();
    sources.getUsdCnyRate.mockReset();
    sources.getVesRates.mockResolvedValue({
      oficial: {
        rate: 846.5,
        date: "2026-09-19",
        dateText: "Viernes",
        source: "bcv-direct",
      },
      euro: null,
      paralelo: {
        rate: 973.5,
        date: "2026-09-19",
        source: "estimated-fallback",
        estimated: true,
      },
      spread: { absolute: 127, percentage: 15 },
      timestamp: NOW.toISOString(),
    });
    sources.getUsdCnyRate.mockResolvedValue(null);
  });

  it("rejects roles without rates.update", async () => {
    const { caller } = callerFor({ role: "employee" });
    await expect(caller.pricing.syncRates({ force: false })).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "Permiso denegado: rates.update",
      }) as Error,
    );
    expect(sources.getVesRates).not.toHaveBeenCalled();
  });

  it("stores only server-fetched rates, inside the workspace RLS transaction", async () => {
    const { caller, writes, executed } = callerFor({
      role: "supervisor",
      latestRate: null,
    });

    const result = await caller.pricing.syncRates({ force: true });

    expect(sources.getVesRates).toHaveBeenCalledWith({ fresh: true });
    expect(result.results.map((r) => r.rateType)).toEqual(["bcv"]);
    expect(
      executed.some((q) => q.includes("set_config('role', 'app_user', true)")),
    ).toBe(true);
    expect(written(writes, "exchange_rate")[0]?.values).toMatchObject({
      rate: 846.5,
      source: "bcv-direct (auto-sync 2026-09-19)",
    });
  });

  it("no longer accepts a rate from the client", () => {
    expect("setRate" in pricingRouter._def.procedures).toBe(false);
  });
});

function heldApprovalRow(overrides: Row = {}): Row {
  return {
    id: APPROVAL,
    workspaceId: WORKSPACE,
    approvalType: "price_change",
    status: "pending",
    entityType: "exchange_rate",
    entityId: RATE_ROW,
    requestedBy: CALLER,
    requestedAt: new Date(Date.now() - 60_000),
    reason: "La tasa BCV recibida difiere +20 % de la última registrada",
    metadata: {
      origin: "rate-sync",
      rateType: "bcv",
      rate: 960,
      previousRate: 800,
      variationPct: 20,
      provider: "bcv-direct",
      valueDate: "2026-09-19",
    },
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("approvals", () => {
  it("refuses to open requests on the reserved exchange_rate entity", async () => {
    const { caller, writes } = callerFor({ role: "admin" });
    await expect(
      caller.approvals.request({
        approvalType: "price_change",
        entityType: "exchange_rate",
        entityId: RATE_ROW,
      }),
    ).rejects.toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("still forbids approving your own request", async () => {
    const me = uniqueUser();
    const { caller, writes } = callerFor(
      {
        role: "admin",
        approval: heldApprovalRow({
          entityType: "sales_order",
          metadata: null,
          requestedBy: me,
        }),
      },
      me,
    );
    await expect(caller.approvals.approve({ id: APPROVAL })).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("lets the member whose sync held a rate accept it, applying the rate", async () => {
    const me = uniqueUser();
    const { caller, writes, selects, events } = callerFor(
      { role: "admin", approval: heldApprovalRow({ requestedBy: me }) },
      me,
    );

    await caller.approvals.approve({ id: APPROVAL, reason: "Confirmada" });

    // Same lock order as the sync (rate type, then approval row): a sync and
    // a decision racing on one rate type cannot deadlock.
    const lockAt = events.indexOf("advisory-lock");
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(lockAt).toBeLessThan(events.indexOf("select:approval:for-update"));
    expect(selects.some((q) => q.table === "approval" && q.locked)).toBe(true);
    const resolved = written(writes, "approval", "update")[0];
    expect(resolved?.where).toContain(`"approval"."status" = `);
    expect(resolved?.params).toContain("pending");
    expect(resolved?.values).not.toHaveProperty("reason");
    expect(written(writes, "exchange_rate")[0]?.values).toMatchObject({
      id: RATE_ROW,
      rateType: "bcv",
      rate: 960,
      source: "bcv-direct (auto-sync 2026-09-19, aceptada)",
    });
    expect(written(writes, "system_alert", "update")[0]?.values).toMatchObject({
      isDismissed: true,
    });
  });

  it("does not let a supervisor accept a held rate on their own", async () => {
    const me = uniqueUser();
    const { caller, writes } = callerFor(
      { role: "supervisor", approval: heldApprovalRow({ requestedBy: me }) },
      me,
    );

    await expect(caller.approvals.approve({ id: APPROVAL })).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message:
          "Solo dueños y administradores pueden aceptar una tasa retenida",
      }) as Error,
    );
    expect(written(writes, "exchange_rate")).toEqual([]);
  });

  it("refuses a held rate made obsolete by a newer stored rate", async () => {
    const approval = heldApprovalRow();
    const { caller, writes, selects } = callerFor({
      role: "admin",
      approval,
      newerRate: true,
    });

    await expect(caller.approvals.approve({ id: APPROVAL })).rejects.toThrow(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(written(writes, "exchange_rate")).toEqual([]);
    const newerQuery = selects.find(
      (q) => q.table === "exchange_rate" && q.where.includes('"created_at" >'),
    );
    expect(newerQuery?.params).toEqual(
      expect.arrayContaining([
        WORKSPACE,
        "bcv",
        (approval.requestedAt as Date).toISOString(),
      ]),
    );
  });

  it("rejecting a held rate locks its type first and closes its alerts", async () => {
    const { caller, writes, events } = callerFor({
      role: "admin",
      approval: heldApprovalRow({ requestedBy: OTHER }),
    });

    await caller.approvals.reject({ id: APPROVAL, reason: "Fuente dudosa" });

    const lockAt = events.indexOf("advisory-lock");
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(lockAt).toBeLessThan(events.indexOf("select:approval:for-update"));
    expect(written(writes, "exchange_rate")).toEqual([]);
    const alertUpdates = written(writes, "system_alert", "update");
    expect(alertUpdates.map((w) => w.params)).toContainEqual(
      expect.arrayContaining(["Tasa BCV retenida"]),
    );
    expect(alertUpdates.map((w) => w.params)).toContainEqual(
      expect.arrayContaining([APPROVAL]),
    );
  });

  it("refuses an expired request", async () => {
    const { caller, writes } = callerFor({
      role: "admin",
      approval: heldApprovalRow({
        entityType: "sales_order",
        metadata: null,
        requestedBy: OTHER,
        expiresAt: new Date(Date.now() - 1000),
      }),
    });

    await expect(caller.approvals.approve({ id: APPROVAL })).rejects.toThrow(
      expect.objectContaining({
        code: "PRECONDITION_FAILED",
        message: "La solicitud expiró",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("keeps the requester's reason when rejecting", async () => {
    const { caller, writes } = callerFor({
      role: "admin",
      approval: heldApprovalRow({
        entityType: "sales_order",
        metadata: null,
        requestedBy: OTHER,
      }),
    });

    await caller.approvals.reject({ id: APPROVAL, reason: "Sin soporte" });

    const resolved = written(writes, "approval", "update")[0];
    expect(resolved?.values).toMatchObject({ status: "rejected" });
    expect(resolved?.values).not.toHaveProperty("reason");
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "approval.reject",
      newValue: { reason: "Sin soporte" },
    });
  });
});
