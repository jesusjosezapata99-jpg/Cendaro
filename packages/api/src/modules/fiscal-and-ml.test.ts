/**
 * Cendaro — SENIAT Fiscal Engine, Multi-Branch, ML Vault & Container Search Tests (F11.5 / DCG-F11)
 */
import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import { decryptSecret, encryptSecret } from "../services/crypto-vault";
import { createCallerFactory } from "../trpc";
import { computeFiscalRetentions, computeSeniatBreakdown } from "./fiscal";

const createCaller = createCallerFactory(appRouter);

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FISCAL_DOC_ID = "33333333-3333-4333-8333-333333333333";
const ORDER_ID = "44444444-4444-4444-8444-444444444444";
const AR_ID = "55555555-5555-4555-8555-555555555555";

function getTableName(t: unknown): string {
  if (!t || typeof t !== "object") return "unknown";
  const sym = Object.getOwnPropertySymbols(t).find((s) =>
    s.toString().includes("BaseName"),
  );
  return sym ? String((t as Record<symbol, unknown>)[sym]) : "unknown";
}

describe("Phase 11 — SENIAT Fiscal Engine, AES-256-GCM Vault, ML DLQ & Container Search (DCG-F11)", () => {
  it("computes SENIAT multi-rate IVA (16%, 8%, Exempt) + IGTF 3% and IVA/ISLR retentions deterministically", () => {
    const breakdown = computeSeniatBreakdown({
      lines: [
        { subtotalUsd: 100, taxClassification: "standard_16" },
        { subtotalUsd: 50, taxClassification: "reduced_8" },
        { subtotalUsd: 25, taxClassification: "exempt_0" },
      ],
      igtfBaseUsd: 100,
      exchangeRateBcv: 40,
    });

    expect(breakdown.taxableBase16Usd).toBe(100);
    expect(breakdown.iva16Usd).toBe(16);
    expect(breakdown.taxableBase8Usd).toBe(50);
    expect(breakdown.iva8Usd).toBe(4);
    expect(breakdown.exemptAmountUsd).toBe(25);
    expect(breakdown.igtfBaseUsd).toBe(100);
    expect(breakdown.igtf3Usd).toBe(3);
    // 100 + 16 + 50 + 4 + 25 + 3 = 198 USD
    expect(breakdown.totalUsd).toBe(198);
    expect(breakdown.totalVes).toBe(7920);

    const retentions = computeFiscalRetentions({
      iva16Usd: breakdown.iva16Usd,
      iva8Usd: breakdown.iva8Usd,
      taxableBaseUsd: 150,
      ivaRetentionPct: 75,
      islrRetentionPct: 2,
      exchangeRateBcv: 40,
    });

    // 75% of (16 + 4 = 20) = 15 USD
    expect(retentions.ivaRetentionUsd).toBe(15);
    expect(retentions.ivaRetentionVes).toBe(600);
    // 2% of 150 = 3 USD
    expect(retentions.islrRetentionUsd).toBe(3);
    expect(retentions.totalRetainedUsd).toBe(18);
  });

  it("encrypts and decrypts OAuth tokens with AES-256-GCM and rejects tampered ciphertexts", () => {
    const testKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const secret = "APP_USR-998877665544332211-102615-abcdef123456";

    const encrypted = encryptSecret(secret, testKey);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(secret);

    const decrypted = decryptSecret(encrypted, testKey);
    expect(decrypted).toBe(secret);

    // Tamper with the ciphertext hex
    const parts = encrypted.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:ff00ff00`;
    expect(() => decryptSecret(tampered, testKey)).toThrow();
  });

  it("emits fiscal document, records 75% IVA retention reducing AR balance, queues ML DLQ failures, and searches containers", async () => {
    const insertedTables: string[] = [];
    const updatedTables: { table: string; values: Record<string, unknown> }[] =
      [];

    let lastTable = "";
    const resolveSelect = () => {
      if (lastTable === "workspace") {
        return [{ id: WORKSPACE_ID, plan: "enterprise", status: "active" }];
      }
      if (lastTable === "workspace_module") {
        return [
          { module: "orders" },
          { module: "payments" },
          { module: "marketplace" },
          { module: "containers" },
          { module: "settings" },
        ];
      }
      if (lastTable === "user_profile") {
        return [{ fullName: "Owner Test", status: "active" }];
      }
      if (lastTable === "fiscal_document") {
        return [
          {
            id: FISCAL_DOC_ID,
            workspaceId: WORKSPACE_ID,
            orderId: ORDER_ID,
            documentType: "factura",
            fiscalInvoiceNumber: "A-000100",
            controlNumber: "00-000100",
            buyerRif: "J-12345678-9",
            buyerLegalName: "Cliente Especial C.A.",
            exchangeRateBcv: 40,
            exemptAmountUsd: 0,
            taxableBase16Usd: 100,
            iva16Usd: 16,
            taxableBase8Usd: 0,
            iva8Usd: 0,
            igtfBaseUsd: 0,
            igtf3Usd: 0,
            totalUsd: 116,
            totalVes: 4640,
            ivaRetentionPct: 0,
            ivaRetentionUsd: 0,
            ivaRetentionVes: 0,
            islrRetentionPct: 0,
            islrRetentionUsd: 0,
            issuedAt: new Date("2026-10-20T12:00:00Z"),
          },
        ];
      }
      if (lastTable === "account_receivable") {
        return [
          {
            id: AR_ID,
            orderId: ORDER_ID,
            workspaceId: WORKSPACE_ID,
            balance: 116,
            status: "pending",
          },
        ];
      }
      if (lastTable === "container") {
        return [
          {
            id: "c-1",
            workspaceId: WORKSPACE_ID,
            containerNumber: "MSCU-9988776",
            status: "in_transit",
            costFob: 15000,
            notes: "Frenos cerámicos y pastillas",
            createdAt: new Date(),
          },
        ];
      }
      if (lastTable === "container_item") {
        return [
          {
            id: "ci-1",
            containerId: "c-1",
            workspaceId: WORKSPACE_ID,
            originalName: "Ceramic Brake Pad",
            translatedName: "Pastilla de Freno Cerámica",
            skuHint: "BRK-CER-01",
            categoryHint: "Frenos",
            quantityExpected: 200,
            quantityReceived: 200,
          },
        ];
      }
      if (lastTable === "container_document") {
        return [
          {
            id: "cd-1",
            containerId: "c-1",
            workspaceId: WORKSPACE_ID,
            documentType: "Bill of Lading",
            fileName: "BL-MSCU-9988776.pdf",
            createdAt: new Date(),
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
            id: FISCAL_DOC_ID,
            workspaceId: WORKSPACE_ID,
            fiscalInvoiceNumber: "A-000100",
            controlNumber: "00-000100",
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
      requestId: "req-f11",
      log: logger.child({ requestId: "req-f11" }),
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
    });

    // 1. Record 75% IVA retention -> reduces AR balance from 116 to 104 (16 * 0.75 = 12 USD retained)
    await caller.fiscal.recordRetention({
      fiscalDocumentId: FISCAL_DOC_ID,
      ivaRetentionPct: 75,
      ivaRetentionVoucher: "RET-202610-001",
      islrRetentionPct: 0,
    });

    const arUpdate = updatedTables.find(
      (u) => u.table === "account_receivable",
    );
    expect(arUpdate?.values).toMatchObject({
      balance: 104,
      status: "partial",
    });

    // 2. Ingest ML Webhook with simulated failure -> queues into IntegrationFailure DLQ
    const dlqRes = await caller.integrations.ingestOrderWebhook({
      eventType: "orders_v2",
      payload: { resource: "/orders/998877" },
      simulateFailureMessage: "Timeout contacting ML API",
    });
    expect(dlqRes.status).toBe("queued_dlq");
    expect(insertedTables).toContain("mercadolibre_order_event");
    expect(insertedTables).toContain("integration_failure");

    // 3. Hybrid Container Search
    const searchRes = await caller.container.search({
      query: "Cerámica BRK-CER-01",
      limit: 10,
    });
    expect(searchRes.summary.itemsFound).toBe(1);
    expect(searchRes.matchedItems[0]?.containerNumber).toBe("MSCU-9988776");
  });
});
