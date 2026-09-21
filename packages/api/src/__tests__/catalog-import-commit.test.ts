/**
 * Catalog import integrity (PLAN-2026-09-SECURITY-REMEDIATION F4.2, H4).
 *
 *  - commit locks its session row, so a double submit waits and then returns
 *    the committed result instead of inserting every product twice.
 *  - Each row commits inside its own savepoint: a failing row is rolled back
 *    and reported while the rest of the file is still applied. Before, the
 *    first database error aborted the batch transaction and every later
 *    statement — including the "mark row as failed" update — failed too.
 *  - The default warehouse for initial stock must be an active warehouse of
 *    the workspace (it came from the client and was never checked).
 *  - A repeated `create` with the same idempotency key returns its session
 *    instead of first expiring it as "stale".
 */
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { catalogImportRouter } from "../modules/catalog-import";
import { createCallerFactory, createTRPCRouter } from "../trpc";

const WORKSPACE = "00000000-0000-4000-8000-0000000000a1";
const WAREHOUSE = "00000000-0000-4000-8000-0000000000a2";
const SESSION = "00000000-0000-4000-8000-0000000000a3";
const KEY = "00000000-0000-4000-8000-0000000000a4";
const CALLER = "00000000-0000-4000-8000-0000000000a5";

type Row = Record<string, unknown>;

interface Write {
  op: "insert" | "update";
  table: string;
  values: Row | Row[];
}

interface Scenario {
  session?: Row | null;
  sessionRows?: Row[];
  /** Warehouse lookup result (null = not an active warehouse of the workspace). */
  warehouse?: { isActive: boolean } | null;
  /** Session found by idempotency key in `create`. */
  existingByKey?: { id: string; status: string } | null;
  /** Caller's unfinished sessions, which `create` expires as stale. */
  activeSessions?: { id: string }[];
  /** SKU whose product insert fails. */
  failSku?: string;
}

const dialect = new PgDialect();

let idCounter = 200;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function fakeDb(s: Scenario) {
  const writes: Write[] = [];
  const selects: { table: string; where: string; locked: boolean }[] = [];
  // Postgres semantics: after a failed statement the (sub)transaction is
  // aborted and every later statement fails until it is rolled back.
  const frames: { aborted: boolean }[] = [];
  const abortedError = () =>
    new Error("current transaction is aborted, commands ignored");
  const top = () => frames[frames.length - 1];

  const selectRows = (table: string, where: string): Row[] => {
    switch (table) {
      case "user_profile":
        return [{ fullName: "Caller" }];
      case "workspace":
        return [{ plan: "pro" }];
      case "workspace_module":
        return [{ id: nextId() }];
      case "warehouse":
        return s.warehouse ? [s.warehouse] : [];
      case "import_session":
        if (where.includes(`"idempotencyKey"`)) {
          return s.existingByKey ? [s.existingByKey] : [];
        }
        if (where.includes(`"status" in`)) return s.activeSessions ?? [];
        return s.session ? [s.session] : [];
      case "import_session_row":
        return s.sessionRows ?? [];
      default:
        return [];
    }
  };

  const chain = (op: "select" | "insert" | "update") => {
    let table = "";
    let where = "";
    let locked = false;
    let values: Row | Row[] = {};
    const self: Record<string, unknown> = {};
    for (const method of ["orderBy", "limit", "returning"]) {
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
      if (condition) where = dialect.sqlToQuery(condition).sql;
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
      if (top()?.aborted) {
        return Promise.reject(abortedError()).then(onFulfilled, onRejected);
      }
      if (op === "select") {
        selects.push({ table, where, locked });
        return Promise.resolve(selectRows(table, where)).then(
          onFulfilled,
          onRejected,
        );
      }
      const single = Array.isArray(values) ? {} : values;
      if (op === "insert" && table === "product" && single.sku === s.failSku) {
        const frame = top();
        if (frame) frame.aborted = true;
        return Promise.reject(new Error("duplicate key value")).then(
          onFulfilled,
          onRejected,
        );
      }
      writes.push({ op, table, values });
      return Promise.resolve([{ id: nextId(), ...single }]).then(
        onFulfilled,
        onRejected,
      );
    };
    return self;
  };

  const target = (op: "insert" | "update") => (t: unknown) => {
    const c = chain(op);
    (c.from as (t: unknown) => unknown)(t);
    return c;
  };

  const db: Record<string, unknown> = {
    execute: (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      if (text.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: [
            {
              member_id: nextId(),
              member_role: "supervisor",
              member_status: "active",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
    select: () => chain("select"),
    insert: target("insert"),
    update: target("update"),
  };
  // Nested transactions behave like savepoints: a callback that rejects rolls
  // back its writes and un-aborts the parent; a callback that swallowed an
  // error still fails when its savepoint is released, like RELEASE SAVEPOINT
  // on an aborted transaction.
  db.transaction = async (fn: (tx: typeof db) => Promise<unknown>) => {
    const mark = writes.length;
    frames.push({ aborted: false });
    try {
      const result = await fn(db);
      if (top()?.aborted) throw abortedError();
      return result;
    } catch (error) {
      writes.length = mark;
      throw error;
    } finally {
      frames.pop();
    }
  };

  return { db, writes, selects };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ catalogImport: catalogImportRouter }),
);

function callerFor(s: Scenario) {
  const fake = fakeDb(s);
  const caller = createCaller({
    user: { id: CALLER, email: "caller@example.com" },
    db: fake.db as never,
    requestId: "req-catalog-import",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-catalog-import" }),
    workspaceId: WORKSPACE,
  });
  return { caller, ...fake };
}

function dryRunSession(metadata: Row | null = null): Row {
  return {
    id: SESSION,
    userId: CALLER,
    status: "dry_run",
    expiresAt: new Date(Date.now() + 60_000),
    metadata,
    filename: "catalogo.xlsx",
    idempotencyKey: KEY,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
}

function insertRow(sku: string, index: number, quantity?: number): Row {
  return {
    id: nextId(),
    rowIndex: index,
    status: "valid",
    action: "insert",
    rawData: { sku, name: `Producto ${sku}`, rowNumber: index + 2, quantity },
    resolvedCategoryId: null,
    resolvedBrandId: null,
    resolvedProductId: null,
  };
}

function written(writes: Write[], table: string): Write[] {
  return writes.filter((w) => w.table === table);
}

describe("catalogImport.commit", () => {
  it("locks its session so a double submit cannot import twice", async () => {
    const { caller, selects } = callerFor({
      session: dryRunSession(),
      sessionRows: [],
    });

    await caller.catalogImport.commit({ sessionId: SESSION });

    const sessionRead = selects.find((q) => q.table === "import_session");
    expect(sessionRead?.locked).toBe(true);
  });

  it("rolls back only the failing row and applies the rest", async () => {
    const { caller, writes } = callerFor({
      session: dryRunSession(),
      sessionRows: [insertRow("OK-1", 0), insertRow("BAD-1", 1)],
      failSku: "BAD-1",
    });

    const result = await caller.catalogImport.commit({ sessionId: SESSION });

    expect(result).toMatchObject({ inserted: 1, failed: 1 });
    expect(result.errors).toEqual([
      expect.objectContaining({ sku: "BAD-1", code: "COMMIT_ERROR" }),
    ]);
    expect(
      written(writes, "product").map((w) => (w.values as Row).sku),
    ).toEqual(["OK-1"]);
    const rowStatuses = written(writes, "import_session_row").map(
      (w) => (w.values as Row).status,
    );
    expect(rowStatuses).toEqual(["committed", "failed"]);
    expect(written(writes, "import_session")[0]?.values).toMatchObject({
      status: "committed",
      inserted: 1,
      failed: 1,
    });
  });

  it("refuses a default warehouse that is not active in the workspace", async () => {
    const { caller, writes } = callerFor({
      session: dryRunSession({ defaultWarehouseId: WAREHOUSE }),
      sessionRows: [insertRow("OK-1", 0, 5)],
      warehouse: null,
    });

    await expect(
      caller.catalogImport.commit({ sessionId: SESSION }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message:
          "El almacén elegido para el stock inicial no está activo en este workspace",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("creates initial stock in a valid default warehouse", async () => {
    const { caller, writes } = callerFor({
      session: dryRunSession({ defaultWarehouseId: WAREHOUSE }),
      sessionRows: [insertRow("OK-1", 0, 5)],
      warehouse: { isActive: true },
    });

    await caller.catalogImport.commit({ sessionId: SESSION });

    expect(written(writes, "stock_ledger")[0]?.values).toMatchObject({
      warehouseId: WAREHOUSE,
      quantity: 5,
    });
  });
});

describe("catalogImport.create", () => {
  const input = {
    filename: "catalogo.xlsx",
    idempotencyKey: KEY,
    rows: [{ rowNumber: 2, sku: "OK-1", name: "Producto" }],
  };

  it("refuses a default warehouse outside the workspace", async () => {
    const { caller, writes } = callerFor({ warehouse: null });

    await expect(
      caller.catalogImport.create({ ...input, defaultWarehouseId: WAREHOUSE }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message:
          "El almacén elegido para el stock inicial no está activo en este workspace",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("returns the session of a repeated key without expiring it", async () => {
    const existing = nextId();
    const { caller, writes } = callerFor({
      existingByKey: { id: existing, status: "pending" },
      activeSessions: [{ id: existing }],
    });

    const result = await caller.catalogImport.create(input);

    expect(result).toEqual({ sessionId: existing });
    expect(writes).toEqual([]);
  });
});
