import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";
import {
  buildAuditIntegrityMetadata,
  computeAuditChainHash,
  GENESIS_AUDIT_HASH,
  verifyAuditChain,
} from "./audit";

const createCaller = createCallerFactory(appRouter);

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const WAREHOUSE_ID = "55555555-5555-4555-8555-555555555555";
const CREDIT_NOTE_ID = "66666666-6666-4666-8666-666666666666";
const AR_ID = "77777777-7777-4777-8777-777777777777";

function getTableName(t: unknown): string {
  if (!t || typeof t !== "object") return "unknown";
  const sym = Object.getOwnPropertySymbols(t).find((s) =>
    s.toString().includes("BaseName"),
  );
  return sym ? String((t as Record<symbol, unknown>)[sym]) : "unknown";
}

describe("Phase 10 — Credit Notes & WORM Audit Cryptographic Chain (DCG-F10)", () => {
  it("verifies an intact audit hash chain and detects tampering of any intermediate record", () => {
    const row1Meta = buildAuditIntegrityMetadata({
      workspaceId: WORKSPACE_ID,
      actorId: USER_ID,
      action: "sales.createOrder",
      entity: "sales_order",
      entityId: ORDER_ID,
      newValue: { total: 100 },
    });
    const row1Integrity =
      typeof row1Meta._integrityHash === "string"
        ? row1Meta._integrityHash
        : "";
    const row1Chain = computeAuditChainHash(GENESIS_AUDIT_HASH, row1Integrity);

    const row2Meta = buildAuditIntegrityMetadata({
      workspaceId: WORKSPACE_ID,
      actorId: USER_ID,
      action: "credit_note.create",
      entity: "credit_note",
      entityId: CREDIT_NOTE_ID,
      newValue: { totalUsd: 40 },
    });
    const row2Integrity =
      typeof row2Meta._integrityHash === "string"
        ? row2Meta._integrityHash
        : "";
    const row2Chain = computeAuditChainHash(row1Chain, row2Integrity);

    const row1Record = {
      id: "audit-1",
      workspaceId: WORKSPACE_ID,
      actorId: USER_ID,
      action: "sales.createOrder",
      entity: "sales_order",
      entityId: ORDER_ID,
      newValue: { total: 100 },
      metadata: {
        ...row1Meta,
        _prevHash: GENESIS_AUDIT_HASH,
        _chainHash: row1Chain,
      },
      prevHash: GENESIS_AUDIT_HASH,
      chainHash: row1Chain,
    };

    const row2Record = {
      id: "audit-2",
      workspaceId: WORKSPACE_ID,
      actorId: USER_ID,
      action: "credit_note.create",
      entity: "credit_note",
      entityId: CREDIT_NOTE_ID,
      newValue: { totalUsd: 40 },
      metadata: {
        ...row2Meta,
        _prevHash: row1Chain,
        _chainHash: row2Chain,
      },
      prevHash: row1Chain,
      chainHash: row2Chain,
    };

    const chainRows = [row1Record, row2Record];

    const intactResult = verifyAuditChain(chainRows);
    expect(intactResult.valid).toBe(true);
    expect(intactResult.totalChecked).toBe(2);
    expect(intactResult.brokenAtId).toBeNull();
    expect(intactResult.manifestHash).toHaveLength(64);

    // Tamper 1 character in the first record's payload
    const tamperedPayloadRows = [
      {
        ...row1Record,
        newValue: { total: 999 },
      },
      row2Record,
    ];
    const tamperedResult = verifyAuditChain(tamperedPayloadRows);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.brokenAtId).toBe("audit-1");
    expect(tamperedResult.brokenReason).toBe("payload_integrity_mismatch");

    // Tamper the link pointer on the second record
    const brokenLinkRows = [
      row1Record,
      {
        ...row2Record,
        prevHash: "forged-prev-hash",
      },
    ];
    const brokenLinkResult = verifyAuditChain(brokenLinkRows);
    expect(brokenLinkResult.valid).toBe(false);
    expect(brokenLinkResult.brokenAtId).toBe("audit-2");
    expect(brokenLinkResult.brokenReason).toBe("prev_hash_link_mismatch");
  });

  it("creates a credit note validating billed quantities and approves it with stock return + AR reduction", async () => {
    const insertedTables: string[] = [];
    const updatedTables: { table: string; values: Record<string, unknown> }[] =
      [];

    let lastTable = "";
    const resolveSelect = () => {
      if (lastTable === "workspace_member") {
        return [{ role: "owner", status: "active" }];
      }
      if (lastTable === "workspace") {
        return [{ id: WORKSPACE_ID, plan: "enterprise", status: "active" }];
      }
      if (lastTable === "workspace_module") {
        return [{ module: "orders" }, { module: "audit" }];
      }
      if (lastTable === "user_profile") {
        return [{ fullName: "Owner Test", status: "active" }];
      }
      if (lastTable === "sales_order") {
        return [
          {
            id: ORDER_ID,
            workspaceId: WORKSPACE_ID,
            orderNumber: "ORD-1001",
            customerId: null,
            status: "invoiced",
            total: 100,
          },
        ];
      }
      if (lastTable === "order_item") {
        return [
          {
            id: "oi-1",
            orderId: ORDER_ID,
            workspaceId: WORKSPACE_ID,
            productId: PRODUCT_ID,
            quantity: 5,
            unitPrice: 20,
          },
        ];
      }
      if (lastTable === "credit_note") {
        return [
          {
            id: CREDIT_NOTE_ID,
            workspaceId: WORKSPACE_ID,
            creditNoteNumber: "NC-001",
            orderId: ORDER_ID,
            status: "pending_approval",
            returnToStock: true,
            warehouseId: WAREHOUSE_ID,
            totalUsd: 40,
          },
        ];
      }
      if (lastTable === "credit_note_item") {
        return [
          {
            id: "cni-1",
            creditNoteId: CREDIT_NOTE_ID,
            workspaceId: WORKSPACE_ID,
            productId: PRODUCT_ID,
            quantity: 2,
            unitPriceUsd: 20,
            subtotalUsd: 40,
          },
        ];
      }
      if (lastTable === "stock_ledger") {
        return [{ id: "sl-1", quantity: 10 }];
      }
      if (lastTable === "account_receivable") {
        return [
          {
            id: AR_ID,
            orderId: ORDER_ID,
            workspaceId: WORKSPACE_ID,
            amount: 100,
            paidAmount: 0,
            balance: 100,
            status: "pending",
          },
        ];
      }
      return [];
    };

    const chain: Record<string, unknown> = {
      from: vi.fn((t: unknown) => {
        lastTable = getTableName(t);
        return chain;
      }),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      for: vi.fn(() => chain),
      values: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      set: vi.fn((vals: Record<string, unknown>) => {
        updatedTables.push({ table: lastTable, values: vals });
        return chain;
      }),
      returning: vi.fn(() =>
        Promise.resolve([
          {
            id: CREDIT_NOTE_ID,
            workspaceId: WORKSPACE_ID,
            creditNoteNumber: "NC-001",
            orderId: ORDER_ID,
            status: "applied",
            totalUsd: 40,
          },
        ]),
      ),
      then: (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolveSelect()).then(onFulfilled),
    };

    const mockDb = {
      select: vi.fn(() => chain),
      insert: vi.fn((t: unknown) => {
        lastTable = getTableName(t);
        insertedTables.push(lastTable);
        return chain;
      }),
      update: vi.fn((t: unknown) => {
        lastTable = getTableName(t);
        return chain;
      }),
      execute: vi.fn(() =>
        Promise.resolve({
          rows: [
            {
              member_id: "mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm",
              member_role: "owner",
              member_status: "active",
            },
          ],
        }),
      ),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockDb),
      ),
    };

    const caller = createCaller({
      db: mockDb as never,
      user: { id: USER_ID, email: "owner@cendaro.com" },
      workspaceId: WORKSPACE_ID,
      requestId: "req-f10",
      log: logger.child({ requestId: "req-f10" }),
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
    });

    const approved = await caller.creditNotes.approve({
      id: CREDIT_NOTE_ID,
      externalRefundReference: "PM-998877",
    });

    expect(approved?.status).toBe("applied");
    expect(insertedTables).toContain("stock_movement");
    const arUpdate = updatedTables.find(
      (u) => u.table === "account_receivable",
    );
    expect(arUpdate?.values).toMatchObject({
      balance: 60,
      status: "partial",
    });
  });
});
