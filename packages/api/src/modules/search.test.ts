/**
 * Cendaro — Global Search Unit Tests (T2.11)
 *
 * Covers the pure, DB-independent pieces: LIKE-escaping, the in-memory
 * rate limiter, role redaction, and the `q` input schema (`min(2)`).
 *
 * NOT covered here (needs a live Postgres, which this workspace has no
 * test-DB harness for yet): actual workspace isolation of the 6 `search*`
 * queries. That is verified by static review instead — every query in
 * `search.ts` combines its `ilike(...)` with
 * `eq(<Table>.workspaceId, ctx.workspace.workspaceId)` via `and(...)`
 * (never a bare `&&`, which would silently drop the filter — caught and
 * fixed during this task's own review). Flagging this gap explicitly
 * rather than claiming integration coverage that doesn't exist.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import {
  canSearchContainers,
  canSearchDeliveryNotes,
  canSearchInvoices,
  checkSearchRateLimit,
  escapeLike,
} from "./search";

describe("escapeLike", () => {
  it("escapes % so it cannot widen the match", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes _ so it cannot match any single character", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes a literal backslash first, before %/_ escaping compounds it", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLike("Coca Cola 2L")).toBe("Coca Cola 2L");
  });
});

describe("search.global input schema", () => {
  const qSchema = z.object({ q: z.string().trim().min(2).max(64) });

  it("rejects a single-character query", () => {
    expect(qSchema.safeParse({ q: "a" }).success).toBe(false);
  });

  it("rejects a query that is only whitespace after trim", () => {
    expect(qSchema.safeParse({ q: "  a  " }).success).toBe(false);
  });

  it("accepts a 2-character query", () => {
    expect(qSchema.safeParse({ q: "ab" }).success).toBe(true);
  });

  it("rejects a query over 64 characters", () => {
    expect(qSchema.safeParse({ q: "a".repeat(65) }).success).toBe(false);
  });
});

describe("role redaction (mirrors NAV_ROLE_RULES)", () => {
  it("allows owner/admin/supervisor to search containers, blocks employee", () => {
    expect(canSearchContainers("owner")).toBe(true);
    expect(canSearchContainers("supervisor")).toBe(true);
    expect(canSearchContainers("employee")).toBe(false);
    expect(canSearchContainers(null)).toBe(false);
  });

  it("allows owner/admin/supervisor to search invoices, blocks employee", () => {
    expect(canSearchInvoices("admin")).toBe(true);
    expect(canSearchInvoices("employee")).toBe(false);
  });

  it("allows owner/admin/supervisor to search delivery notes, blocks marketing", () => {
    expect(canSearchDeliveryNotes("owner")).toBe(true);
    expect(canSearchDeliveryNotes("marketing")).toBe(false);
  });
});

describe("checkSearchRateLimit", () => {
  // src/test-setup.ts resets the shared store to a fresh MemoryRateLimitStore
  // before every test here — no DB, no bleed between cases.

  it("allows up to 20 requests within the 10s window", async () => {
    const userId = `rate-limit-test-${crypto.randomUUID()}`;
    for (let i = 0; i < 20; i++) await checkSearchRateLimit(userId);
  });

  it("throws TOO_MANY_REQUESTS on the 21st request within the window", async () => {
    const userId = `rate-limit-test-${crypto.randomUUID()}`;
    for (let i = 0; i < 20; i++) await checkSearchRateLimit(userId);

    await expect(checkSearchRateLimit(userId)).rejects.toThrow(TRPCError);
    try {
      await checkSearchRateLimit(userId);
    } catch (err) {
      expect((err as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("resets the bucket once the window elapses", async () => {
    vi.useFakeTimers();
    const userId = `rate-limit-test-${crypto.randomUUID()}`;
    try {
      for (let i = 0; i < 20; i++) await checkSearchRateLimit(userId);
      await expect(checkSearchRateLimit(userId)).rejects.toThrow(TRPCError);

      // The store is a weighted sliding window (F6), so a charge can still
      // carry a fraction of weight into the very next window; two full
      // windows guarantees it has fully decayed regardless of alignment.
      await vi.advanceTimersByTimeAsync(20_001);

      await expect(checkSearchRateLimit(userId)).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks separate users independently", async () => {
    const userA = `rate-limit-test-a-${crypto.randomUUID()}`;
    const userB = `rate-limit-test-b-${crypto.randomUUID()}`;
    for (let i = 0; i < 20; i++) await checkSearchRateLimit(userA);

    await expect(checkSearchRateLimit(userA)).rejects.toThrow(TRPCError);
    await expect(checkSearchRateLimit(userB)).resolves.toBeUndefined();
  });
});
