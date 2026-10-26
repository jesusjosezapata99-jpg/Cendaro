import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

let wsCounter = 401;
function nextWorkspaceId() {
  wsCounter += 1;
  return `b0000000-0000-4000-8000-${String(wsCounter).padStart(12, "0")}`;
}

const USER_ID = "a0000000-0000-4000-8000-000000000401";
const PRODUCT_ID = "c0000000-0000-4000-8000-000000000401";
const SESSION_ID = "d0000000-0000-4000-8000-000000000401";
const EVENT_ID = "e0000000-0000-4000-8000-000000000401";

const createCaller = createCallerFactory(appRouter);

function buildMockContext(opts: {
  selectQueue?: unknown[][];
  updateReturning?: unknown[];
}) {
  const workspaceId = nextWorkspaceId();
  const selectQueue = [...(opts.selectQueue ?? [])];
  const insertedRows: unknown[] = [];
  const updatedValues: unknown[] = [];

  const nextSelectResult = (shape?: Record<string, unknown>) => {
    if (shape && "plan" in shape) return [{ plan: "enterprise" }];
    if (shape && "fullName" in shape) return [{ fullName: "Owner QA" }];
    if (
      shape &&
      Object.keys(shape).length === 1 &&
      "id" in shape &&
      selectQueue.length === 0
    ) {
      return [{ id: "mod-row" }];
    }
    return selectQueue.shift() ?? [{ id: "mod-row" }];
  };

  const makeSelectChain = (rows: unknown[]) => {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      offset: () => chain,
      limit: () => {
        const p = Promise.resolve(rows) as Promise<unknown[]> & {
          for: () => Promise<unknown[]>;
          offset: () => Promise<unknown[]>;
        };
        p.for = () => Promise.resolve(rows);
        p.offset = () => Promise.resolve(rows);
        return p;
      },
      then: (
        onFulfilled?: ((value: unknown[]) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const tx = {
    execute: () => Promise.resolve({ rows: [] }),
    select: (shape?: Record<string, unknown>) =>
      makeSelectChain(nextSelectResult(shape)),
    insert: () => ({
      values: (val: unknown) => {
        insertedRows.push(val);
        const p = Promise.resolve(opts.updateReturning ?? []) as Promise<
          unknown[]
        > & {
          onConflictDoUpdate: () => {
            returning: () => Promise<unknown[]>;
          };
          returning: () => Promise<unknown[]>;
        };
        p.onConflictDoUpdate = () => ({
          returning: () =>
            Promise.resolve(
              opts.updateReturning ?? [{ id: "price-1", amountUsd: 25 }],
            ),
        });
        p.returning = () =>
          Promise.resolve(opts.updateReturning ?? [{ id: "row-1" }]);
        return p;
      },
    }),
    update: () => ({
      set: (val: unknown) => {
        updatedValues.push(val);
        return {
          where: () => {
            const p = Promise.resolve(
              opts.updateReturning ?? [{ id: EVENT_ID, isApproved: true }],
            ) as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>;
            };
            p.returning = () =>
              Promise.resolve(
                opts.updateReturning ?? [{ id: EVENT_ID, isApproved: true }],
              );
            return p;
          },
        };
      },
    }),
  };

  const db = {
    ...tx,
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: "10000000-0000-4000-8000-000000000001",
            member_role: "owner",
            member_status: "active",
          },
        ],
      }),
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const caller = createCaller({
    user: { id: USER_ID, email: "owner@cendaro.com", aal: "aal2" },
    db: db as never,
    requestId: "req-cat-test",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-cat-test" }),
    workspaceId,
  });

  return { caller, insertedRows, updatedValues };
}

describe("catalog, pricing & import invariants (Phase 4)", () => {
  it("catalogImport.getSession returns expired status without executing UPDATE inside read-only query", async () => {
    const expiredDate = new Date(Date.now() - 3600_000);
    const { caller, updatedValues } = buildMockContext({
      selectQueue: [
        [{ id: "mod-catalog" }],
        [
          {
            id: SESSION_ID,
            userId: USER_ID,
            status: "dry_run",
            expiresAt: expiredDate,
          },
        ],
      ],
    });

    const session = await caller.catalogImport.getSession({
      sessionId: SESSION_ID,
    });
    expect(session.status).toBe("expired");
    expect(updatedValues).toHaveLength(0);
  });

  it("catalog.setPrice records a manual PriceHistory entry with old and new USD amounts", async () => {
    const { caller, insertedRows } = buildMockContext({
      selectQueue: [
        [{ id: "mod-pricing" }],
        [{ amountUsd: 18.5 }], // existing price
      ],
    });

    await caller.catalog.setPrice({
      productId: PRODUCT_ID,
      priceType: "store",
      amountUsd: 24.0,
      rateUsed: 42.5,
    });

    const historyRow = insertedRows.find(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        "newAmountUsd" in r &&
        "trigger" in r,
    );
    expect(historyRow).toMatchObject({
      productId: PRODUCT_ID,
      priceType: "store",
      oldAmountUsd: 18.5,
      newAmountUsd: 24.0,
      rateUsed: 42.5,
      trigger: "manual",
    });
  });

  it("catalog.listProducts enriches items with basePriceUsd and posPriceUsd", async () => {
    const { caller } = buildMockContext({
      selectQueue: [
        [{ id: "mod-catalog" }],
        [
          {
            id: PRODUCT_ID,
            sku: "SKU-100",
            name: "Taladro Industrial",
            barcode: "759123456",
            imageUrl: null,
            status: "active",
            brandId: null,
            categoryId: null,
            supplierId: null,
            createdAt: new Date(),
          },
        ],
        [{ total: 1 }],
        [
          {
            productId: PRODUCT_ID,
            priceType: "wholesale",
            amountUsd: 85.0,
          },
          {
            productId: PRODUCT_ID,
            priceType: "store",
            amountUsd: 110.0,
          },
        ],
      ],
    });

    const res = await caller.catalog.listProducts({ limit: 10, offset: 0 });
    expect(res.items[0]).toMatchObject({
      id: PRODUCT_ID,
      sku: "SKU-100",
      basePriceUsd: 85.0,
      posPriceUsd: 110.0,
    });
  });

  it("pricing.approveRepricing recalculates ProductPrice Bs amounts and records PriceHistory", async () => {
    const { caller, updatedValues, insertedRows } = buildMockContext({
      selectQueue: [
        [{ id: "mod-pricing" }],
        [
          {
            id: EVENT_ID,
            isApproved: false,
            oldRate: 40.0,
            newRate: 45.0,
            productsAffected: 1,
          },
        ],
        [
          {
            id: "pp-1",
            productId: PRODUCT_ID,
            priceType: "store",
            amountUsd: 10.0,
            amountBs: 400.0,
          },
        ],
      ],
    });

    await caller.pricing.approveRepricing({ id: EVENT_ID });

    expect(
      updatedValues.some(
        (u) =>
          typeof u === "object" &&
          u !== null &&
          "amountBs" in u &&
          (u as { amountBs: number }).amountBs === 450,
      ),
    ).toBe(true);

    const autoHistory = insertedRows.find(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        "trigger" in r &&
        (r as { trigger: string }).trigger === "auto",
    );
    expect(autoHistory).toMatchObject({
      productId: PRODUCT_ID,
      priceType: "store",
      oldAmountUsd: 10.0,
      newAmountUsd: 10.0,
      rateUsed: 45.0,
      trigger: "auto",
    });
  });
});
