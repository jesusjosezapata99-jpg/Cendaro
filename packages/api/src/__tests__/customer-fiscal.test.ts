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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { CUSTOMER_PERSON_KEY_SQL, customerTypeEnum } from "@cendaro/db/schema";
import {
  createCustomerSchema,
  CUSTOMER_TYPES,
  fiscalIdTypeOf,
  fiscalPersonKey,
  isFiscalInvoiceReady,
  normalizeFiscalId,
  rifCheckDigit,
  updateCustomerSchema,
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

  it.each([
    "J-12345678",
    "V-1234",
    "12345678",
    "V-1234567890",
    // Leading zeros are dropped, leaving fewer than 5 digits.
    "V-01234",
  ])("rejects cédula %s", (raw) => {
    expect(normalizeFiscalId("cedula", raw).ok).toBe(false);
  });

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

  it("accepts a blank email so a form can clear it", () => {
    expect(
      createCustomerSchema.safeParse({ ...valid, email: "" }).success,
    ).toBe(true);
    expect(
      createCustomerSchema.safeParse({ ...valid, email: "no-es-correo" })
        .success,
    ).toBe(false);
  });
});

describe("updateCustomerSchema", () => {
  const valid = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Cliente Semilla",
    idType: "rif" as const,
    identification: "G-20000303-0",
    address: "Av. Urdaneta, Edif. Centro, Caracas",
    customerType: "retail" as const,
  };

  it("applies the same fiscal requirements as creation", () => {
    expect(updateCustomerSchema.safeParse(valid).success).toBe(true);
    expect(
      updateCustomerSchema.safeParse({ ...valid, address: "Caracas" }).success,
    ).toBe(false);
    expect(
      updateCustomerSchema.safeParse({
        ...valid,
        identification: "SEED-J-1234567",
      }).success,
    ).toBe(false);
  });

  it("requires the customer type so it is never reset to retail", () => {
    const { customerType: _type, ...withoutType } = valid;
    expect(updateCustomerSchema.safeParse(withoutType).success).toBe(false);
  });

  it("requires the customer id", () => {
    const { id: _id, ...withoutId } = valid;
    expect(updateCustomerSchema.safeParse(withoutId).success).toBe(false);
  });
});

const personalRif = (letter: string, digits: string) =>
  `${letter}-${digits}-${rifCheckDigit(letter, digits)}`;

describe("fiscalPersonKey ⇄ customer.person_key (migration 014)", () => {
  /**
   * Evaluated with CUSTOMER_PERSON_KEY_SQL in production (read-only SELECT,
   * 2026-09-17); the TypeScript mirror must return the same keys.
   */
  it.each([
    ["V-12345678", "V-12345678"],
    ["V-12345678-1", "V-12345678"],
    ["V-00123456-7", "V-123456"],
    ["V-123456", "V-123456"],
    ["E-81234567", "E-81234567"],
    ["E-81234567-0", "E-81234567"],
    ["J-12345678-9", "J-12345678-9"],
    ["G-20000303-0", "G-20000303-0"],
    ["PAS-AB1234567", "PAS-AB1234567"],
    ["V-123456789", "V-123456789"],
    ["V-00000000-1", "V-00000000-1"],
    ["SEED-J-1234567", "SEED-J-1234567"],
  ])("maps %s to %s like Postgres", (identification, key) => {
    expect(fiscalPersonKey(identification)).toBe(key);
  });

  it("gives a cédula and its personal RIF the same key", () => {
    for (const [letter, digits, cedula] of [
      ["V", "12345678", "V-12345678"],
      ["V", "00123456", "V-123456"],
      ["E", "81234567", "E-81234567"],
    ] as const) {
      const rif = personalRif(letter, digits);
      expect(normalizeFiscalId("rif", rif)).toEqual({ ok: true, value: rif });
      expect(fiscalPersonKey(rif)).toBe(fiscalPersonKey(cedula));
    }
  });

  it("keeps companies and government bodies apart from people", () => {
    expect(fiscalPersonKey("J-12345678-9")).not.toBe(
      fiscalPersonKey("V-12345678"),
    );
  });

  it("uses the same expression in the schema and the migration", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../../../db/migrations/014_customer_person_key.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    // Once in the pre-check GROUP BY, once in the generated column.
    expect(migration.split(CUSTOMER_PERSON_KEY_SQL)).toHaveLength(3);
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
  existing?: { id: string; name: string; identification?: string }[];
  /** Customer row returned by a lookup on "customer"."id". */
  customer?: Record<string, unknown>;
  /** Order row returned by a lookup on "sales_order"."id". */
  order?: Record<string, unknown>;
  /** Error thrown by the customer insert or update. */
  insertError?: Error;
  /** Product lookups find none of the requested ids. */
  missingProducts?: boolean;
}

function fakeDb(opts: FakeOptions) {
  const wheres: { sql: string; params: unknown[] }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];

  const chain = (kind: "select" | "insert" | "update") => {
    let lastWhere = "";
    let lastParams: unknown[] = [];
    let values: Record<string, unknown> = {};
    const self: Record<string, unknown> = {};
    for (const method of [
      "from",
      "leftJoin",
      "orderBy",
      "groupBy",
      "limit",
      "offset",
      "returning",
    ]) {
      self[method] = () => self;
    }
    self.values = (v: Record<string, unknown>) => {
      values = v;
      return self;
    };
    self.set = (v: Record<string, unknown>) => {
      values = v;
      return self;
    };
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        lastWhere = rendered.sql;
        lastParams = rendered.params;
        wheres.push({ sql: rendered.sql, params: rendered.params });
      }
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      if (kind === "insert" || kind === "update") {
        if (opts.insertError && "identification" in values) {
          return Promise.reject(opts.insertError).then(onFulfilled, onRejected);
        }
        (kind === "insert" ? inserted : updated).push(values);
        return Promise.resolve([{ id: nextId(), ...values }]).then(
          onFulfilled,
          onRejected,
        );
      }
      return Promise.resolve(selectRows(lastWhere, lastParams)).then(
        onFulfilled,
        onRejected,
      );
    };
    return self;
  };

  const selectRows = (where: string, params: unknown[]): unknown[] => {
    if (where.includes(`"product"."id" in (`)) {
      // Params: workspace id first, then the requested product ids.
      return opts.missingProducts ? [] : params.slice(1).map((id) => ({ id }));
    }
    if (where.includes(`"customer"."personKey" = $`)) {
      return opts.existing ?? [];
    }
    if (where.includes(`"sales_order"."id" = $`)) {
      return opts.order ? [opts.order] : [];
    }
    if (where.includes(`"customer"."id" = $`)) {
      return opts.customer ? [opts.customer] : [];
    }
    return [{ id: nextId(), plan: "pro", fullName: "Caller" }];
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

  return { db, wheres, inserted, updated };
}

const createCaller = createCallerFactory(appRouter);

function callerFor(opts: FakeOptions) {
  const { db, wheres, inserted, updated } = fakeDb(opts);
  const caller = createCaller({
    user: { id: nextId(), email: "caller@example.com" },
    db: db as never,
    requestId: "req-customer-fiscal",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-customer-fiscal" }),
    workspaceId: nextId(),
  });
  return { caller, wheres, inserted, updated };
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

describe("cédula ⇄ personal RIF duplicates", () => {
  const cedulaCustomer = {
    ...validCustomer,
    name: "María Pérez",
    idType: "cedula" as const,
    identification: "V-12.345.678",
  };

  it("looks the person up by person key when registering", async () => {
    const { caller, wheres } = callerFor({ role: "employee" });
    await caller.sales.createCustomer({
      ...cedulaCustomer,
      idType: "rif",
      identification: personalRif("V", "12345678"),
    });
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"customer"."personKey" = $`) &&
          w.params.includes("V-12345678"),
      ),
    ).toBe(true);
  });

  it("names the matching registration in the conflict", async () => {
    const rif = personalRif("V", "12345678");
    const { caller, inserted } = callerFor({
      role: "employee",
      existing: [{ id: nextId(), name: "María Pérez", identification: rif }],
    });
    await expect(
      caller.sales.createCustomer(cedulaCustomer),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CONFLICT",
        message: expect.stringContaining(`${rif}: María Pérez`) as string,
      }) as Error,
    );
    expect(inserted).toEqual([]);
  });
});

describe("sales.updateCustomer", () => {
  const seedCustomer = {
    id: "00000000-0000-4000-8000-00000000abcd",
    name: "Cliente Semilla",
    legalName: null,
    identification: "SEED-J-1234567",
    address: null,
    customerType: "retail",
    phone: "0412",
    email: null,
    creditLimit: 0,
    creditDays: 0,
  };
  const fix = {
    ...validCustomer,
    id: seedCustomer.id,
    name: "Cliente Semilla",
    customerType: "retail" as const,
  };

  it("skips the duplicate lookup when the document is unchanged", async () => {
    const { caller, updated, wheres } = callerFor({
      role: "supervisor",
      customer: { ...seedCustomer, identification: "V-12345678" },
    });
    await caller.sales.updateCustomer({
      ...fix,
      idType: "cedula",
      identification: "V-12345678",
    });
    expect(updated.find((row) => "identification" in row)).toMatchObject({
      identification: "V-12345678",
    });
    expect(
      wheres.some((w) => w.sql.includes(`"customer"."personKey" = $`)),
    ).toBe(false);
  });

  it("lets a supervisor complete a seed customer's fiscal data", async () => {
    const { caller, updated } = callerFor({
      role: "supervisor",
      customer: seedCustomer,
    });
    await caller.sales.updateCustomer({ ...fix, phone: "" });
    expect(updated.find((row) => "identification" in row)).toMatchObject({
      identification: "G-20000303-0",
      address: "Av. Urdaneta, Edif. Centro, Caracas",
      phone: null,
      creditLimit: 0,
    });
  });

  it("forbids an employee (customers.update)", async () => {
    const { caller, updated } = callerFor({
      role: "employee",
      customer: seedCustomer,
    });
    await expect(caller.sales.updateCustomer(fix)).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "Permiso denegado: customers.update",
      }) as Error,
    );
    expect(updated.filter((row) => "identification" in row)).toEqual([]);
  });

  it("returns NOT_FOUND for a customer outside the workspace", async () => {
    const { caller } = callerFor({ role: "supervisor" });
    await expect(caller.sales.updateCustomer(fix)).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
  });

  it("rejects incomplete fiscal data", async () => {
    const { caller } = callerFor({
      role: "supervisor",
      customer: seedCustomer,
    });
    await expect(
      caller.sales.updateCustomer({ ...fix, address: "" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
  });

  it("excludes the customer itself from the duplicate lookup", async () => {
    const { caller, wheres } = callerFor({
      role: "supervisor",
      customer: seedCustomer,
    });
    await caller.sales.updateCustomer(fix);
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"customer"."id" <> $`) &&
          w.params.includes(seedCustomer.id),
      ),
    ).toBe(true);
  });

  it("rejects a document registered to another customer", async () => {
    const { caller } = callerFor({
      role: "supervisor",
      customer: seedCustomer,
      existing: [
        { id: nextId(), name: "Otro", identification: "G-20000303-0" },
      ],
    });
    await expect(caller.sales.updateCustomer(fix)).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );
  });

  it("maps a concurrent unique violation to CONFLICT", async () => {
    const { caller } = callerFor({
      role: "supervisor",
      customer: seedCustomer,
      insertError: Object.assign(new Error("update failed"), {
        cause: { code: "23505" },
      }),
    });
    await expect(caller.sales.updateCustomer(fix)).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );
  });
});

describe("sales.updateOrderStatus — SENIAT buyer data", () => {
  const order = {
    id: "00000000-0000-4000-8000-0000000000fe",
    customerId: "00000000-0000-4000-8000-0000000000ff",
    channel: "store",
    status: "confirmed",
    // Skips the stock lifecycle, which is not under test here.
    stockDeducted: true,
  };
  const address = "Av. Urdaneta, Edif. Centro, Caracas";

  it("blocks invoicing a customer with incomplete fiscal data", async () => {
    const { caller, updated } = callerFor({
      role: "employee",
      order,
      customer: { name: "Seed", identification: "SEED-J-1", address: null },
    });
    await expect(
      caller.sales.updateOrderStatus({ id: order.id, status: "invoiced" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(updated.filter((row) => "status" in row)).toEqual([]);
  });

  it("invoices a customer with complete fiscal data", async () => {
    const { caller, updated } = callerFor({
      role: "employee",
      order,
      customer: { name: "SENIAT", identification: "G-20000303-0", address },
    });
    await caller.sales.updateOrderStatus({ id: order.id, status: "invoiced" });
    expect(updated).toContainEqual({ status: "invoiced" });
  });

  it("invoices a Consumidor Final order without a customer", async () => {
    const { caller, updated } = callerFor({
      role: "employee",
      order: { ...order, customerId: null },
    });
    await caller.sales.updateOrderStatus({ id: order.id, status: "invoiced" });
    expect(updated).toContainEqual({ status: "invoiced" });
  });

  it("does not check fiscal data for other statuses", async () => {
    const { caller, updated } = callerFor({
      role: "employee",
      order,
      customer: { name: "Seed", identification: null, address: null },
    });
    await caller.sales.updateOrderStatus({ id: order.id, status: "cancelled" });
    expect(updated).toContainEqual({ status: "cancelled" });
  });
});

describe("sales.checkoutPos — atomic POS sale", () => {
  const productA = "00000000-0000-4000-8000-0000000000a1";
  const productB = "00000000-0000-4000-8000-0000000000b2";
  const sale = {
    items: [
      { productId: productA, quantity: 2, unitPrice: 10, discount: 1 },
      { productId: productB, quantity: 1, unitPrice: 5 },
    ],
    payments: [
      { method: "cash" as const, amount: 20, currency: "USD" as const },
      {
        method: "mobile_payment" as const,
        amount: 3,
        currency: "VES" as const,
        amountBs: 450,
        reference: "1234",
      },
    ],
  };
  const readyBuyer = {
    name: "SENIAT",
    identification: "G-20000303-0",
    address: "Av. Urdaneta, Edif. Centro, Caracas",
  };

  const rowsWith = (rows: Record<string, unknown>[], key: string) =>
    rows
      .flatMap((row) => (Array.isArray(row) ? row : [row]))
      .filter((row): row is Record<string, unknown> => key in row);

  it("records order, lines, payments, invoice and stock in one call", async () => {
    const { caller, inserted, updated } = callerFor({ role: "employee" });

    const result = await caller.sales.checkoutPos(sale);

    // total = 2 × (10 − 1) + 5 = 23; paid 23
    expect(result).toMatchObject({ total: 23, totalPaid: 23, change: 0 });
    expect(rowsWith(inserted, "channel")).toEqual([
      expect.objectContaining({
        channel: "store",
        subtotal: 25,
        discount: 2,
        total: 23,
        totalPaid: 23,
      }),
    ]);
    expect(rowsWith(inserted, "lineTotal")).toHaveLength(2);
    expect(rowsWith(inserted, "method")).toEqual([
      expect.objectContaining({
        method: "cash",
        amount: 20,
        payerName: "Consumidor Final",
      }),
      expect.objectContaining({
        method: "mobile_payment",
        amount: 3,
        reference: "1234",
        notes: "Pago POS (Bs 450.00)",
      }),
    ]);
    expect(updated).toContainEqual({ status: "invoiced" });
    expect(rowsWith(inserted, "movementType")).not.toHaveLength(0);
    expect(updated).toContainEqual({ stockDeducted: true });
  });

  it("lets the trigger number the order", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await caller.sales.checkoutPos(sale);
    expect(rowsWith(inserted, "channel")[0]).toMatchObject({
      orderNumber: "",
    });
  });

  it("keeps only the sale amount when cash change is given", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    const result = await caller.sales.checkoutPos({
      ...sale,
      payments: [{ method: "cash", amount: 50, currency: "USD" }],
    });
    expect(result).toMatchObject({ received: 50, change: 27, totalPaid: 23 });
    expect(rowsWith(inserted, "channel")[0]).toMatchObject({ totalPaid: 23 });
    expect(rowsWith(inserted, "method")).toEqual([
      expect.objectContaining({
        method: "cash",
        amount: 23,
        notes: "Pago POS (recibido $50.00, vuelto $27.00)",
      }),
    ]);
  });

  it("takes the change from cash, not from the card payment", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await caller.sales.checkoutPos({
      ...sale,
      payments: [
        { method: "pos_terminal", amount: 20, currency: "USD" },
        { method: "cash", amount: 5, currency: "USD" },
      ],
    });
    // total 23: card keeps 20, cash keeps 3 of the 5 received.
    expect(rowsWith(inserted, "method")).toEqual([
      expect.objectContaining({ method: "pos_terminal", amount: 20 }),
      expect.objectContaining({ method: "cash", amount: 3 }),
    ]);
  });

  it("drops a cash payment that the change consumes entirely", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await caller.sales.checkoutPos({
      ...sale,
      payments: [
        { method: "transfer", amount: 23, currency: "USD" },
        { method: "cash", amount: 5, currency: "USD" },
      ],
    });
    expect(rowsWith(inserted, "method")).toEqual([
      expect.objectContaining({ method: "transfer", amount: 23 }),
    ]);
  });

  it("rejects change that would come out of a non-cash payment", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await expect(
      caller.sales.checkoutPos({
        ...sale,
        payments: [{ method: "zelle", amount: 30, currency: "USD" }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: expect.stringContaining("vuelto") as string,
      }) as Error,
    );
    expect(rowsWith(inserted, "channel")).toEqual([]);
  });

  it("names a registered buyer on the payments", async () => {
    const customerId = "00000000-0000-4000-8000-0000000000c3";
    const { caller, inserted } = callerFor({
      role: "employee",
      customer: readyBuyer,
    });
    await caller.sales.checkoutPos({ ...sale, customerId });
    expect(rowsWith(inserted, "method")[0]).toMatchObject({
      payerName: "SENIAT",
      payerIdDoc: "G-20000303-0",
    });
  });

  it("writes nothing when the payments do not cover the total", async () => {
    const { caller, inserted, updated } = callerFor({ role: "employee" });
    await expect(
      caller.sales.checkoutPos({
        ...sale,
        payments: [{ method: "cash", amount: 22.9, currency: "USD" }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(rowsWith(inserted, "channel")).toEqual([]);
    expect(updated.filter((row) => "status" in row)).toEqual([]);
  });

  it("writes nothing for a buyer without SENIAT fiscal data", async () => {
    const { caller, inserted } = callerFor({
      role: "employee",
      customer: { name: "Seed", identification: "SEED-J-1", address: null },
    });
    await expect(
      caller.sales.checkoutPos({
        ...sale,
        customerId: "00000000-0000-4000-8000-0000000000c4",
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(rowsWith(inserted, "channel")).toEqual([]);
  });

  it("writes nothing when a product is not in the workspace catalog", async () => {
    const { caller, inserted } = callerFor({
      role: "employee",
      missingProducts: true,
    });
    await expect(caller.sales.checkoutPos(sale)).rejects.toThrowError(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: expect.stringContaining("no existen en el catálogo") as string,
      }) as Error,
    );
    expect(rowsWith(inserted, "channel")).toEqual([]);
  });

  it("rejects a discount larger than the unit price", async () => {
    const { caller, inserted } = callerFor({ role: "employee" });
    await expect(
      caller.sales.checkoutPos({
        ...sale,
        items: [
          { productId: productA, quantity: 1, unitPrice: 5, discount: 6 },
        ],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(rowsWith(inserted, "channel")).toEqual([]);
  });

  it("rejects an empty ticket or a sale without payments", async () => {
    const { caller } = callerFor({ role: "employee" });
    await expect(
      caller.sales.checkoutPos({ ...sale, items: [] }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    await expect(
      caller.sales.checkoutPos({ ...sale, payments: [] }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
  });

  it("forbids roles without pos.create", async () => {
    const { caller } = callerFor({ role: "marketing" });
    await expect(caller.sales.checkoutPos(sale)).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "Permiso denegado: pos.create",
      }) as Error,
    );
  });
});
