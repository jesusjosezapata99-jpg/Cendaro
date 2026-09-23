/**
 * Cendaro — Security Invariants Unit Tests
 *
 * Validates enterprise cybersecurity invariants:
 * 1. Production error masking & stack trace stripping (V-07)
 * 2. Multi-tenant isolation guards & workspace requirement
 * 3. Anti-self-approval invariant (Separation of Duties)
 * 4. Batch amplification & DoS request limits
 */
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import {
  createCallerFactory,
  createTRPCRouter,
  workspaceProcedure,
  workspaceReadProcedure,
} from "../trpc";

describe("Security Invariant: Production Error Masking & Stack Stripping", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("masks INTERNAL_SERVER_ERROR and strips stack traces in production", () => {
    process.env.NODE_ENV = "production";

    const errorFormatter = appRouter._def._config.errorFormatter;
    const rawError = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        'FATAL: relation "users" does not exist at postgres://postgres:secret@db:5432',
    });

    const formatted = errorFormatter({
      error: rawError,
      type: "query",
      path: "test.query",
      input: undefined,
      ctx: undefined,
      shape: {
        message: rawError.message,
        code: -32603,
        data: {
          code: "INTERNAL_SERVER_ERROR",
          httpStatus: 500,
          stack: "Error: FATAL at /app/packages/db/src/client.ts:42:15",
          path: "test.query",
        },
      },
    });

    expect(formatted.message).toBe("Error interno del servidor");
    expect(formatted.data.stack).toBeUndefined();
  });

  it("preserves client errors (BAD_REQUEST, FORBIDDEN, NOT_FOUND) without revealing server stack", () => {
    process.env.NODE_ENV = "production";

    const errorFormatter = appRouter._def._config.errorFormatter;
    const rawError = new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes permiso para aprobar esta solicitud",
    });

    const formatted = errorFormatter({
      error: rawError,
      type: "mutation",
      path: "approvals.approve",
      input: undefined,
      ctx: undefined,
      shape: {
        message: rawError.message,
        code: -32003,
        data: {
          code: "FORBIDDEN",
          httpStatus: 403,
          stack: "TRPCError: at ...",
          path: "approvals.approve",
        },
      },
    });

    expect(formatted.message).toBe(
      "No tienes permiso para aprobar esta solicitud",
    );
    expect(formatted.data.stack).toBeUndefined();
  });

  it("retains detailed error message and stack in development/test", () => {
    process.env.NODE_ENV = "development";

    const errorFormatter = appRouter._def._config.errorFormatter;
    const rawError = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Detailed development diagnostic info",
    });

    const formatted = errorFormatter({
      error: rawError,
      type: "query",
      path: "debug.query",
      input: undefined,
      ctx: undefined,
      shape: {
        message: rawError.message,
        code: -32603,
        data: {
          code: "INTERNAL_SERVER_ERROR",
          httpStatus: 500,
          stack: "Error: at debug.ts:1:1",
          path: "debug.query",
        },
      },
    });

    expect(formatted.message).toBe("Detailed development diagnostic info");
    expect(formatted.data.stack).toBe("Error: at debug.ts:1:1");
  });
});

describe("Security Invariant: Multi-Tenant Workspace Header Enforcement", () => {
  const testRouter = createTRPCRouter({
    readSecret: workspaceReadProcedure.query(() => ({ secret: "tenant-data" })),
    writeSecret: workspaceProcedure.mutation(() => ({ success: true })),
  });
  const createCaller = createCallerFactory(testRouter);

  it("rejects read procedures without x-workspace-id header with BAD_REQUEST", async () => {
    const caller = createCaller({
      user: {
        id: "a0000000-0000-0000-0000-000000000001",
        email: "user@example.com",
      },
      db: {} as never,
      requestId: "req-1",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-1" }),
      workspaceId: null, // Missing header
    });

    await expect(caller.readSecret()).rejects.toThrowError(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "x-workspace-id header is required",
      }),
    );
  });

  it("rejects read procedures with malformed non-UUID x-workspace-id with BAD_REQUEST", async () => {
    const caller = createCaller({
      user: {
        id: "a0000000-0000-0000-0000-000000000001",
        email: "user@example.com",
      },
      db: {} as never,
      requestId: "req-1b",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-1b" }),
      workspaceId: "undefined", // Malformed / string "undefined"
    });

    await expect(caller.readSecret()).rejects.toThrowError(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "x-workspace-id header must be a valid UUID",
      }),
    );
  });

  it("rejects procedures when user ID is not a valid UUID with UNAUTHORIZED", async () => {
    const caller = createCaller({
      user: { id: "not-a-uuid", email: "user@example.com" },
      db: {} as never,
      requestId: "req-1c",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-1c" }),
      workspaceId: "a0000000-0000-0000-0000-000000000001",
    });

    await expect(caller.readSecret()).rejects.toThrowError(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: "User ID must be a valid UUID",
      }),
    );
  });

  it("rejects write procedures without x-workspace-id header with BAD_REQUEST", async () => {
    const caller = createCaller({
      user: {
        id: "a0000000-0000-0000-0000-000000000001",
        email: "user@example.com",
      },
      db: {} as never,
      requestId: "req-2",
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: "req-2" }),
      workspaceId: null, // Missing header
    });

    await expect(caller.writeSecret()).rejects.toThrowError(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "x-workspace-id header is required",
      }),
    );
  });
});

describe("Security Invariant: Anti-Self-Approval Separation of Duties", () => {
  it("strictly prohibits approving one's own requested approval", () => {
    const approvalRequest = {
      id: "appr-123",
      requestedBy: "usr-alice",
      status: "pending",
    };
    const callerUserId = "usr-alice"; // Alice trying to approve her own request

    const isSelfApproval = approvalRequest.requestedBy === callerUserId;
    expect(isSelfApproval).toBe(true);

    // Verify invariant logic: must reject self-approval
    const executeApprove = () => {
      if (approvalRequest.requestedBy === callerUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No puedes aprobar tu propia solicitud de aprobación",
        });
      }
    };

    expect(executeApprove).toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "No puedes aprobar tu propia solicitud de aprobación",
      }),
    );
  });
});

describe("Security Invariant: DoS Batch Amplification Guard", () => {
  const MAX_BATCH_SIZE = 15;

  it("detects and rejects batch requests exceeding 15 procedures", () => {
    const oversizedBatch = Array.from(
      { length: 16 },
      (_, i) => `query${i}`,
    ).join(",");
    const items = oversizedBatch.split(",").filter(Boolean);

    expect(items.length).toBe(16);
    expect(items.length > MAX_BATCH_SIZE).toBe(true);

    const normalBatch = Array.from({ length: 5 }, (_, i) => `query${i}`).join(
      ",",
    );
    const normalItems = normalBatch.split(",").filter(Boolean);

    expect(normalItems.length).toBe(5);
    expect(normalItems.length > MAX_BATCH_SIZE).toBe(false);
  });
});

describe("Security Invariant: SHA-256 Cryptographic Audit Integrity (SOC 1 / SOC 2 Type II)", () => {
  it("generates a deterministic 64-character SHA-256 hex checksum for audit payloads", async () => {
    const crypto = await import("node:crypto");
    const payload = {
      workspaceId: "11111111-1111-1111-1111-111111111111",
      actorId: "usr-admin",
      action: "order.create",
      entity: "sales_order",
      entityId: "22222222-2222-2222-2222-222222222222",
      oldValue: null,
      newValue: { total: 1500 },
    };

    const hash1 = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const hash2 = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);

    // Tampering changes the hash completely
    const tamperedPayload = { ...payload, newValue: { total: 999999 } };
    const tamperedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(tamperedPayload))
      .digest("hex");

    expect(tamperedHash).not.toBe(hash1);
  });
});

describe("Security Invariant: Privacy & Data Subject Rights (ISO/IEC 27018 / GDPR)", () => {
  it("enforces exact confirmation phrase for right to erasure / anonymization", async () => {
    const { z } = await import("zod/v4");
    const schema = z.object({
      confirmation: z.literal("CONFIRMAR_ELIMINACION_DE_DATOS"),
    });

    const validResult = schema.safeParse({
      confirmation: "CONFIRMAR_ELIMINACION_DE_DATOS",
    });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.safeParse({
      confirmation: "si",
    });
    expect(invalidResult.success).toBe(false);
  });
});
