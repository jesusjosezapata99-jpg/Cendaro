/**
 * SENIAT buyer fiscal data and POS customer registration.
 *
 * Providencias SNAT/2011/00071 (art. 13) and SNAT/2024/000102 (art. 7)
 * require the buyer's name or razón social, RIF (or cédula / passport for
 * natural persons) and domicilio fiscal on every invoice. These tests pin the
 * shared validation (@cendaro/validators fiscal.ts) and sales.createCustomer:
 * employees may register customers, never with credit, and a document can
 * only be registered once per workspace.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { customerTypeEnum } from "@cendaro/db/schema";
import {
  createCustomerSchema,
  CUSTOMER_TYPES,
  fiscalIdTypeOf,
  isFiscalInvoiceReady,
  normalizeFiscalId,
  rifCheckDigit,
} from "@cendaro/validators";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

// ── Shared validation ──────────────────────────────────────────────

describe("rifCheckDigit", () => {
  // Published RIFs of public institutions, used as known-good vectors.
  it.each([
    ["G", "20000303", 0], // SENIAT
    ["G", "20009997", 6], // Banco de Venezuela
  ])("computes %s-%s-%i", (letter, digits, expected) => {
    expect(rifCheckDigit(letter, digits)).toBe(expected);
  });

  it("has no published value for C or unknown letters", () => {
    expect(rifCheckDigit("C", "12345678")).toBeNull();
    expect(rifCheckDigit("X", "12345678")).toBeNull();
  });

  it("requires exactly 8 digits", () => {
    expect(rifCheckDigit("J", "1234567")).toBeNull();
  });
});

describe("normalizeFiscalId — RIF", () => {
  it.each(["G-20000303-0", "g200003030", "G 20000303 0", "G-20.000.303-0"])(
    "accepts %s as G-20000303-0",
    (raw) => {
      expect(normalizeFiscalId("rif", raw)).toEqual({
        ok: true,
        value: "G-20000303-0",
      });
    },
  );

  it("rejects a wrong check digit", () => {
    expect(normalizeFiscalId("rif", "G-20000303-1").ok).toBe(false);
  });

  it("rejects a missing check digit or wrong length", () => {
    expect(normalizeFiscalId("rif", "J-12345678").ok).toBe(false);
    expect(normalizeFiscalId("rif", "J-1234567-8").ok).toBe(false);
  });

  it("rejects an unknown letter", () => {
    expect(normalizeFiscalId("rif", "X-12345678-9").ok).toBe(false);
  });

  it("accepts C (consejo comunal) by format only", () => {
    expect(normalizeFiscalId("rif", "C-12345678-9")).toEqual({
      ok: true,
      value: "C-12345678-9",
    });
  });
});

describe("normalizeFiscalId — cédula and passport", () => {
  it.each([
    ["V-12.345.678", "V-12345678"],
    ["v12345678", "V-12345678"],
    ["E-81234567", "E-81234567"],
    ["V-0123456", "V-123456"],
  ])("normalizes cédula %s to %s", (raw, value) => {
    expect(normalizeFiscalId("cedula", raw)).toEqual({ ok: true, value });
  });

  it.each(["J-12345678", "V-1234", "12345678", "V-1234567890"])(
    "rejects cédula %s",
    (raw) => {
      expect(normalizeFiscalId("cedula", raw).ok).toBe(false);
    },
  );

  it("normalizes passports with a PAS- prefix", () => {
    expect(normalizeFiscalId("pasaporte", "ab 123-4567")).toEqual({
      ok: true,
      value: "PAS-AB1234567",
    });
    expect(normalizeFiscalId("pasaporte", "PAS-AB1234567")).toEqual({
      ok: true,
      value: "PAS-AB1234567",
    });
    expect(normalizeFiscalId("pasaporte", "A1").ok).toBe(false);
  });
});

describe("fiscalIdTypeOf / isFiscalInvoiceReady", () => {
  it("detects the type of canonical identifications", () => {
    expect(fiscalIdTypeOf("G-20000303-0")).toBe("rif");
    expect(fiscalIdTypeOf("V-12345678")).toBe("cedula");
    expect(fiscalIdTypeOf("PAS-AB1234567")).toBe("pasaporte");
    expect(fiscalIdTypeOf("G-20000303-1")).toBeNull();
    expect(fiscalIdTypeOf("SEED-J-1234567")).toBeNull();
    expect(fiscalIdTypeOf(null)).toBeNull();
  });

  const address = "Av. Urdaneta, Caracas";

  it("requires name, a valid document and the domicilio fiscal", () => {
    expect(
      isFiscalInvoiceReady({
        name: "SENIAT",
        identification: "G-20000303-0",
        address,
      }),
    ).toBe(true);
    expect(
      isFiscalInvoiceReady({
        name: "SENIAT",
        identification: "G-20000303-0",
        address: null,
      }),
    ).toBe(false);
    expect(
      isFiscalInvoiceReady({
        name: "Cliente",
        identification: "SEED-J-1234567",
        address,
      }),
    ).toBe(false);
    expect(
      isFiscalInvoiceReady({ name: "", identification: "V-12345678", address }),
    ).toBe(false);
  });
});

describe("createCustomerSchema", () => {
  const valid = {
    name: "Inversiones Miranda C.A.",
    idType: "rif" as const,
    identification: "G-20000303-0",
    address: "Av. Urdaneta, Edif. Centro, Caracas",
  };

  it("accepts the SENIAT minimum and defaults the customer type", () => {
    expect(createCustomerSchema.parse(valid).customerType).toBe("retail");
  });

  it.each([
    ["name", { name: "" }],
    ["identification", { identification: "G-20000303-1" }],
    ["address", { address: "Caracas" }],
    ["address", { address: undefined }],
  ])("rejects an invalid %s", (field, override) => {
    const result = createCustomerSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });

  it("CUSTOMER_TYPES matches the customer_type DB enum", () => {
    expect([...CUSTOMER_TYPES]).toEqual(customerTypeEnum.enumValues);
  });
});

// ── sales.createCustomer / listCustomers ───────────────────────────

const dialect = new PgDialect();

let idCounter = 0;

/** Fresh ids keep the process-wide membership and module caches apart. */
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

interface FakeOptions {
  role: string;
  /** Rows returned by the duplicate-identification lookup. */
  existing?: { id: string; name: string }[];
  /** Error thrown by the customer insert. */
  insertError?: Error;
}

function fakeDb(opts: FakeOptions) {
  const wheres: { sql: string; params: unknown[] }[] = [];
  const inserted: Record<string, unknown>[] = [];

  const chain = (kind: "select" | "insert" | "update") => {
    let lastWhere = "";
    let values: Record<string, unknown> = {};
    const self: Record<string, unknown> = {};
    for (const method of [
      "from",
      "leftJoin",
      "orderBy",
      "limit",
      "offset",
      "set",
      "returning",
    ]) {
      self[method] = () => self;
    }
    self.values = (v: Record<string, unknown>) => {
      values = v;
      return self;
    };
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        lastWhere = rendered.sql;
        wheres.push({ sql: rendered.sql, params: rendered.params });
      }
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      if (kind === "insert") {
        if (opts.insertError && "identification" in values) {
          return Promise.reject(opts.insertError).then(onFulfilled, onRejected);
        }
        inserted.push(values);
        return Promise.resolve([{ id: nextId(), ...values }]).then(
          onFulfilled,
          onRejected,
        );
      }
      const rows = lastWhere.includes(`"customer"."identification" = $`)
        ? (opts.existing ?? [])
        : [{ id: nextId(), plan: "pro", fullName: "Caller" }];
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    };
    return self;
  };

  const db = {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: nextId(),
            member_role: opts.role,
            member_status: "active",
          },
        ],
      }),
    select: () => chain("select"),
    insert: () => chain("insert"),
    update: () => chain("update"),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  return { db, wheres, inserted };
}

const createCaller = createCallerFactory(appRouter);

function callerFor(opts: FakeOptions) {
  const { db, wheres, inserted } = fakeDb(opts);
  const caller = createCaller({
    user: { id: nextId(), email: "caller@example.com" },
    db: db as never,
    requestId: "req-customer-fiscal",
    log: logger.child({ requestId: "req-customer-fiscal" }),
    workspaceId: nextId(),
  });
  return { caller, wheres, inserted };
}

const validCustomer = {
  name: "Inversiones Miranda C.A.",
  idType: "rif" as const,
  identification: "g-20.000.303-0",
  address: "Av. Urdaneta, Edif. Centro, Caracas",
};

describe("sales.createCustomer", () => {
  it("lets an employee register a customer with canonical fiscal data", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });

    await caller.sales.createCustomer(validCustomer);

    const customerRow = inserted.find((row) => "identification" in row);
    expect(customerRow).toMatchObject({
      name: "Inversiones Miranda C.A.",
      identification: "G-20000303-0",
      address: "Av. Urdaneta, Edif. Centro, Caracas",
    });
  });

  it("rejects an invalid RIF before touching the database", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await expect(
      caller.sales.createCustomer({
        ...validCustomer,
        identification: "G-20000303-1",
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(inserted).toEqual([]);
  });

  it("rejects a customer without domicilio fiscal", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await expect(
      caller.sales.createCustomer({ ...validCustomer, address: "" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(inserted).toEqual([]);
  });

  it.each([{ creditLimit: 500 }, { creditDays: 30 }])(
    "forbids an employee from granting credit (%o)",
    async (credit) => {
      const { caller, inserted } = callerFor({ role: "employee" });
      await expect(
        caller.sales.createCustomer({ ...validCustomer, ...credit }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: "Solo la gerencia puede otorgar crédito a un cliente",
        }) as Error,
      );
      expect(inserted).toEqual([]);
    },
  );

  it("lets a supervisor grant credit", async () => {
    const { caller, inserted } = callerFor({ role: "supervisor" });
    await caller.sales.createCustomer({ ...validCustomer, creditLimit: 500 });
    expect(inserted.find((row) => "identification" in row)).toMatchObject({
      creditLimit: 500,
    });
  });

  it("rejects a document already registered in the workspace", async () => {
    const { caller, inserted, wheres } = callerFor({
      role: "employee",
      existing: [{ id: nextId(), name: "Cliente Existente" }],
    });
    await expect(
      caller.sales.createCustomer(validCustomer),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CONFLICT",
        message: expect.stringContaining(
          "G-20000303-0: Cliente Existente",
        ) as string,
      }) as Error,
    );
    expect(inserted).toEqual([]);
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"customer"."workspaceId" = $`) &&
          w.params.includes("G-20000303-0"),
      ),
    ).toBe(true);
  });

  it("maps a unique violation from a concurrent insert to CONFLICT", async () => {
    const { caller } = callerFor({
      role: "employee",
      insertError: Object.assign(new Error("insert failed"), {
        cause: { code: "23505" },
      }),
    });
    await expect(
      caller.sales.createCustomer(validCustomer),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );
  });

  it("forbids marketing from registering customers", async () => {
    const { caller } = callerFor({ role: "marketing" });
    await expect(
      caller.sales.createCustomer(validCustomer),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "Permiso denegado: customers.create",
      }) as Error,
    );
  });
});

describe("sales.listCustomers search", () => {
  it("matches a RIF typed without dashes against the stored form", async () => {
    const { caller, wheres } = callerFor({ role: "employee" });
    await caller.sales.listCustomers({ search: "g200003030" });
    expect(
      wheres.some(
        (w) =>
          w.sql.includes("regexp_replace") && w.params.includes("%G200003030%"),
      ),
    ).toBe(true);
  });

  it("escapes LIKE wildcards in the search term", async () => {
    const { caller, wheres } = callerFor({ role: "employee" });
    await caller.sales.listCustomers({ search: "50%_off" });
    expect(wheres.some((w) => w.params.includes("%50\\%\\_off%"))).toBe(true);
  });
});
