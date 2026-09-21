/**
 * Shared rate limiter (PLAN-2026-09-SECURITY-REMEDIATION F6, finding M1).
 *
 * The old limiter was a module-scoped Map: on Vercel that is one counter per
 * serverless instance, so a burst spread over cold starts multiplied the
 * allowance and every deploy cleared every lockout. The store is now an
 * interface with two implementations — Postgres for production, memory for
 * development and as a fallback — so moving to Upstash later replaces one
 * class instead of every call site.
 */
import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import {
  MemoryRateLimitStore,
  weightedCount,
  windowStartFor,
  withFallback,
} from "./rate-limit";

const MINUTE = 60_000;

describe("sliding window maths", () => {
  it("aligns a window to fixed boundaries", () => {
    expect(windowStartFor(90_000, MINUTE)).toBe(60_000);
    expect(windowStartFor(60_000, MINUTE)).toBe(60_000);
    expect(windowStartFor(59_999, MINUTE)).toBe(0);
  });

  it("weighs the previous window by how far the current one advanced", () => {
    // Half way into the window: half of the previous window still counts.
    expect(weightedCount(10, 2, 30_000, MINUTE)).toBe(7);
    // At the very start almost the whole previous window counts.
    expect(weightedCount(10, 1, 0, MINUTE)).toBe(11);
    // At the end it has faded out.
    expect(weightedCount(10, 3, 59_999, MINUTE)).toBeCloseTo(3, 1);
  });

  it("ignores a previous window that does not exist", () => {
    expect(weightedCount(0, 4, 10_000, MINUTE)).toBe(4);
  });
});

describe("MemoryRateLimitStore", () => {
  const rule = (max: number) => [
    { key: "login:ip:1.2.3.4", windowMs: MINUTE, max },
  ];

  it("allows up to the limit and blocks the next request", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      const result = await store.consume(rule(3), now);
      expect(result.success).toBe(true);
    }

    const blocked = await store.consume(rule(3), now);
    expect(blocked.success).toBe(false);
    expect(blocked.blockedBy).toBe("login:ip:1.2.3.4");
    expect(blocked.reset).toBeGreaterThan(now);
  });

  it("records nothing when one rule of a composite fails", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;
    const rules = [
      { key: "ip", windowMs: MINUTE, max: 5 },
      { key: "user", windowMs: MINUTE, max: 1 },
    ];

    await store.consume(rules, now);
    const blocked = await store.consume(rules, now);

    expect(blocked.success).toBe(false);
    expect(blocked.blockedBy).toBe("user");
    // The IP rule must not have been charged for the rejected request.
    expect(await store.count("ip", MINUTE, now)).toBe(1);
  });

  it("lets the budget recover as the window slides", async () => {
    const store = new MemoryRateLimitStore();
    const start = 2 * MINUTE;

    for (let i = 0; i < 5; i++) await store.consume(rule(5), start);
    expect((await store.consume(rule(5), start)).success).toBe(false);

    // A full window later the previous one has faded out completely.
    expect((await store.consume(rule(5), start + 2 * MINUTE)).success).toBe(
      true,
    );
  });

  it("counts failures without spending the request budget", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;

    await store.recordFailure("failures:user:ana", MINUTE, now);
    await store.recordFailure("failures:user:ana", MINUTE, now);

    expect(await store.count("failures:user:ana", MINUTE, now)).toBe(2);
    expect((await store.consume(rule(1), now)).success).toBe(true);
  });

  it("blocks a locked key until the lock expires", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;

    await store.lock("lockout:ana", now + 5_000, "too many failures");

    expect(await store.lockedUntil("lockout:ana", now)).toBe(now + 5_000);
    const blocked = await store.consume(
      [{ key: "lockout:ana", windowMs: MINUTE, max: 100 }],
      now,
    );
    expect(blocked.success).toBe(false);
    expect(await store.lockedUntil("lockout:ana", now + 6_000)).toBeNull();
  });
});

describe("withFallback", () => {
  const rules = [{ key: "ip", windowMs: MINUTE, max: 1 }];

  it("uses the primary store while it works", async () => {
    const primary = new MemoryRateLimitStore();
    const backup = new MemoryRateLimitStore();
    const store = withFallback(primary, backup, { error: vi.fn() } as never);

    expect((await store.consume(rules, 1)).success).toBe(true);
    expect((await store.consume(rules, 1)).success).toBe(false);
    // The backup was never touched.
    expect(await backup.count("ip", MINUTE, 1)).toBe(0);
  });

  it("falls back and reports when the primary store fails", async () => {
    const broken = {
      consume: vi.fn().mockRejectedValue(new Error("db down")),
      count: vi.fn().mockRejectedValue(new Error("db down")),
      recordFailure: vi.fn().mockRejectedValue(new Error("db down")),
      lock: vi.fn().mockRejectedValue(new Error("db down")),
      lockedUntil: vi.fn().mockRejectedValue(new Error("db down")),
    };
    const backup = new MemoryRateLimitStore();
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const store = withFallback(broken, backup, logger);

    // Still limits, on the per-instance backup rather than not at all.
    expect((await store.consume(rules, 1)).success).toBe(true);
    expect((await store.consume(rules, 1)).success).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});
