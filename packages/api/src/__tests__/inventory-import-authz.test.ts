/**
 * Inventory import procedures (PLAN-2026-09-SECURITY-REMEDIATION F4.2, H4).
 *
 *  - Overwriting locked stock (`forceLocked`) and resetting a whole warehouse
 *    (`initializeCommit`) are owner/admin decisions; `inventory.update` alone
 *    (supervisors) is not enough. The UI already said so, the server did not.
 *  - Quantities are computed from ledger rows read FOR UPDATE in the same
 *    transaction, never from the browser's preview.
 *  - A repeated idempotency key waits on an advisory lock and returns the
 *    first run's result instead of applying the file twice (the old check read
 *    100 arbitrary audit rows, unordered and unlocked).
 */
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { inventoryImportRouter } from "../modules/inventory-import";
import { createCallerFactory, createTRPCRouter } from "../trpc";

const WORKSPACE = "00000000-0000-4000-8000-0000000000a1";
const WAREHOUSE = "00000000-0000-4000-8000-0000000000a2";
const KEY = "00000000-0000-4000-8000-0000000000a3";
const P1 = "00000000-0000-4000-8000-000000000001";
const P2 = "00000000-0000-4000-8000-000000000002";

type Row = Record<string, unknown>;

interface Write {
  op: "insert" | "update";
  table: string;
  values: Row | Row[];
  conflict: "update" | "nothing" | null;
}

interface Scenario {
  role: string;
  previousImport?: { id: string; newValue: Row } | null;
  knownProducts?: string[];
  ledger?: { productId: string; quantity: number; isLocked: boolean }[];
  existingBrands?: { id: string; slug: string }[];
  existingProducts?: { id: string; sku: string }[];
}

const dialect = new PgDialect();

let idCounter = 100;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function fakeDb(s: Scenario) {
  const writes: Write[] = [];
  const selects: {
    table: string;
    where: string;
    params: unknown[];
    locked: boolean;
  }[] = [];
  const executed: { sql: string; params: unknown[] }[] = [];

  const selectRows = (table: string, shape: Row): Row[] => {
    switch (table) {
      case "user_profile":
        return [{ fullName: "Caller" }];
      case "workspace":
        return [{ plan: "pro" }];
      case "workspace_module":
        return [{ id: nextId() }];
      case "warehouse":
        return [{ isActive: true }];
      case "audit_log":
        return s.previousImport ? [s.previousImport] : [];
      case "stock_ledger":
        return s.ledger ?? [];
      case "brand":
        return s.existingBrands ?? [];
      case "product":
        return "sku" in shape
          ? (s.existingProducts ?? [])
          : (s.knownProducts ?? []).map((id) => ({ id }));
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
    let conflict: Write["conflict"] = null;
    const self: Record<string, unknown> = {};
    for (const method of ["innerJoin", "leftJoin", "orderBy", "limit"]) {
      self[method] = () => self;
    }
    self.returning = () => self;
    self.onConflictDoUpdate = () => {
      conflict = "update";
      return self;
    };
    self.onConflictDoNothing = () => {
      conflict = "nothing";
      return self;
    };
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
        return Promise.resolve(selectRows(table, shape)).then(
          onFulfilled,
          onRejected,
        );
      }
      writes.push({ op, table, values, conflict });
      const rows = (Array.isArray(values) ? values : [values]).map((v) => ({
        id: nextId(),
        ...v,
      }));
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
      const rendered = dialect.sqlToQuery(query);
      executed.push({ sql: rendered.sql, params: rendered.params });
      if (rendered.sql.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: [
            {
              member_id: nextId(),
              member_role: s.role,
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

  return { db, writes, selects, executed };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ inventoryImport: inventoryImportRouter }),
);

function callerFor(s: Scenario) {
  const fake = fakeDb(s);
  const caller = createCaller({
    user: { id: nextId(), email: "caller@example.com" },
    db: fake.db as never,
    requestId: "req-inventory-import",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-inventory-import" }),
    workspaceId: WORKSPACE,
  });
  return { caller, ...fake };
}

function written(writes: Write[], table: string): Write[] {
  return writes.filter((w) => w.table === table);
}

function commitInput(overrides: Row = {}) {
  return {
    warehouseId: WAREHOUSE,
    mode: "replace" as const,
    rows: [
      {
        rowNumber: 2,
        sku: "SKU-1",
        quantity: 1,
        productId: P1,
        currentQuantity: 9,
      },
    ],
    filename: "conteo.xlsx",
    idempotencyKey: KEY,
    forceLocked: false,
    ...overrides,
  };
}

function initializeInput() {
  return {
    warehouseId: WAREHOUSE,
    filename: "inicial.xlsx",
    idempotencyKey: KEY,
    rows: [
      {
        rowNumber: 2,
        brand: "Acme",
        sku: "NEW-1",
        productName: "Nuevo",
        bultos: 1,
        cajasPerBulk: null,
        unidPerCaja: null,
        presentacion: 1,
        totalUnits: 12,
      },
      {
        rowNumber: 3,
        brand: "Acme",
        sku: "OLD-1",
        productName: "Existente",
        bultos: 1,
        cajasPerBulk: null,
        unidPerCaja: null,
        presentacion: 1,
        totalUnits: 25,
      },
    ],
  };
}

const forbidden = (message: string) =>
  expect.objectContaining({ code: "FORBIDDEN", message }) as Error;

describe("inventoryImport.commit", () => {
  it("rejects a supervisor forcing locked stock before touching data", async () => {
    const { caller, writes, selects } = callerFor({
      role: "supervisor",
      knownProducts: [P1],
      ledger: [{ productId: P1, quantity: 9, isLocked: true }],
    });

    await expect(
      caller.inventoryImport.commit(commitInput({ forceLocked: true })),
    ).rejects.toThrow(
      forbidden(
        "Solo dueños y administradores pueden importar sobre productos bloqueados",
      ),
    );
    expect(writes).toEqual([]);
    expect(selects.some((q) => q.table === "stock_ledger")).toBe(false);
  });

  it("lets an owner force locked stock and records the override", async () => {
    const { caller, writes } = callerFor({
      role: "owner",
      knownProducts: [P1],
      ledger: [{ productId: P1, quantity: 9, isLocked: true }],
    });

    const result = await caller.inventoryImport.commit(
      commitInput({ forceLocked: true }),
    );

    expect(result).toMatchObject({ committed: 1, skipped: 0, totalDelta: -8 });
    expect(written(writes, "stock_ledger")[0]).toMatchObject({
      conflict: "update",
      values: [
        {
          workspaceId: WORKSPACE,
          productId: P1,
          warehouseId: WAREHOUSE,
          quantity: 1,
        },
      ],
    });
    expect(written(writes, "stock_movement")[0]?.values).toEqual([
      expect.objectContaining({
        productId: P1,
        movementType: "adjustment_out",
        quantity: 8,
      }),
    ]);
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "inventory.bulk_import",
      newValue: expect.objectContaining({
        forceLocked: true,
        lockedOverridden: 1,
        idempotencyKey: KEY,
      }) as unknown,
    });
  });

  it("computes the new stock from the ledger it locked, not the preview", async () => {
    const { caller, writes, selects } = callerFor({
      role: "supervisor",
      knownProducts: [P1],
      ledger: [{ productId: P1, quantity: 7, isLocked: false }],
    });

    await caller.inventoryImport.commit(
      commitInput({
        mode: "adjust",
        rows: [
          {
            rowNumber: 2,
            sku: "SKU-1",
            quantity: 5,
            productId: P1,
            currentQuantity: 10,
          },
        ],
      }),
    );

    const ledgerRead = selects.find((q) => q.table === "stock_ledger");
    expect(ledgerRead?.locked).toBe(true);
    expect(ledgerRead?.params).toEqual(
      expect.arrayContaining([WORKSPACE, WAREHOUSE, P1]),
    );
    expect(written(writes, "stock_ledger")[0]?.values).toEqual([
      expect.objectContaining({ productId: P1, quantity: 12 }),
    ]);
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      newValue: expect.objectContaining({ staleBaseRows: 1 }) as unknown,
    });
  });

  it("only reads products of the workspace", async () => {
    const { caller, selects } = callerFor({
      role: "admin",
      knownProducts: [P1],
    });

    await caller.inventoryImport.commit(commitInput());

    const productRead = selects.find((q) => q.table === "product");
    expect(productRead?.params).toEqual(
      expect.arrayContaining([WORKSPACE, P1]),
    );
  });

  it("returns the earlier result for a repeated key without writing", async () => {
    const previousId = nextId();
    const { caller, writes, executed, selects } = callerFor({
      role: "admin",
      previousImport: {
        id: previousId,
        newValue: {
          warehouseId: WAREHOUSE,
          mode: "replace",
          idempotencyKey: KEY,
          committed: 3,
          skipped: 1,
          failed: 0,
          totalDelta: 4,
        },
      },
    });

    const result = await caller.inventoryImport.commit(commitInput());

    expect(result).toEqual({
      committed: 3,
      skipped: 1,
      failed: 0,
      totalDelta: 4,
      errors: [],
      auditLogId: previousId,
    });
    expect(writes).toEqual([]);
    // Key first, then warehouse: a fixed order so two imports cannot deadlock.
    const locks = executed
      .filter((e) => e.sql.includes("pg_advisory_xact_lock"))
      .map((e) => e.params);
    expect(locks).toEqual([
      [`inventory.bulk_import:${WORKSPACE}:${KEY}`],
      [`stock_import:${WORKSPACE}:${WAREHOUSE}`],
    ]);
    const lookup = selects.find((q) => q.table === "audit_log");
    expect(lookup?.where).toContain("->> 'idempotencyKey'");
    expect(lookup?.params).toEqual(expect.arrayContaining([WORKSPACE, KEY]));
  });

  it("refuses a repeated key sent for another warehouse or mode", async () => {
    const previous = (newValue: Row) => ({ id: nextId(), newValue });
    for (const newValue of [
      { warehouseId: nextId(), mode: "replace", idempotencyKey: KEY },
      { warehouseId: WAREHOUSE, mode: "adjust", idempotencyKey: KEY },
    ]) {
      const { caller, writes } = callerFor({
        role: "admin",
        previousImport: previous(newValue),
      });

      await expect(
        caller.inventoryImport.commit(commitInput()),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }) as Error);
      expect(writes).toEqual([]);
    }
  });

  it("writes large files in bounded batches", async () => {
    const count = 1201;
    const ids = Array.from({ length: count }, () => nextId());
    const { caller, writes } = callerFor({
      role: "admin",
      knownProducts: ids,
    });

    const result = await caller.inventoryImport.commit(
      commitInput({
        rows: ids.map((productId, i) => ({
          rowNumber: i + 2,
          sku: `SKU-${i}`,
          quantity: 3,
          productId,
          currentQuantity: 0,
        })),
      }),
    );

    expect(result.committed).toBe(count);
    const sizes = (table: string) =>
      written(writes, table).map((w) => (w.values as Row[]).length);
    expect(sizes("stock_ledger")).toEqual([500, 500, 201]);
    expect(sizes("stock_movement")).toEqual([500, 500, 201]);
    expect(written(writes, "audit_log")).toHaveLength(1);
  });

  it("returns the id of its own audit entry", async () => {
    const { caller, writes } = callerFor({
      role: "admin",
      knownProducts: [P1],
    });

    const result = await caller.inventoryImport.commit(commitInput());

    const audit = written(writes, "audit_log")[0]?.values as Row;
    expect(result.auditLogId).toBe(audit.id);
  });
});

describe("inventoryImport.initializeCommit", () => {
  it("rejects a supervisor resetting a warehouse", async () => {
    const { caller, writes } = callerFor({ role: "supervisor" });

    await expect(
      caller.inventoryImport.initializeCommit(initializeInput()),
    ).rejects.toThrow(
      forbidden(
        "Solo dueños y administradores pueden inicializar el inventario de un almacén",
      ),
    );
    expect(writes).toEqual([]);
  });

  it("creates what is missing and records only real stock changes", async () => {
    const { caller, writes, selects } = callerFor({
      role: "admin",
      existingBrands: [],
      existingProducts: [{ id: P2, sku: "OLD-1" }],
      ledger: [{ productId: P2, quantity: 10, isLocked: false }],
    });

    const result =
      await caller.inventoryImport.initializeCommit(initializeInput());

    expect(result).toMatchObject({
      brandsCreated: 1,
      productsCreated: 1,
      stockEntries: 2,
      failed: 0,
      totalUnits: 37,
    });
    expect(written(writes, "brand")[0]?.values).toEqual([
      expect.objectContaining({ name: "Acme", slug: "acme" }),
    ]);
    expect(written(writes, "product")[0]?.values).toEqual([
      expect.objectContaining({ sku: "NEW-1", workspaceId: WORKSPACE }),
    ]);
    expect(selects.find((q) => q.table === "stock_ledger")?.locked).toBe(true);
    const movements = written(writes, "stock_movement")[0]?.values as Row[];
    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: P2,
          movementType: "adjustment_in",
          quantity: 15,
        }),
        expect.objectContaining({
          movementType: "initial_stock",
          quantity: 12,
        }),
      ]),
    );
  });
});
