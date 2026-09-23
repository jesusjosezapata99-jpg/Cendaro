/**
 * Server-side idle-session enforcement (PLAN-2026-09-SECURITY-REMEDIATION
 * F7.1, finding M2).
 *
 * `/api/trpc` skips proxy.ts's cookie-based idle check entirely ("API/tRPC
 * routes handle their own auth"), so a replayed access token could call tRPC
 * forever without ever being checked for inactivity. `touchSessionActivity`
 * closes that gap at the tRPC layer itself, keyed by the JWT's `session_id`
 * claim rather than a client-supplied cookie.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { IDLE_TIMEOUT_MS, touchSessionActivity } from "./session-activity";

const SESSION = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const dialect = new PgDialect({ casing: "snake_case" });

function fakeDb(lastSeenAt: Date | undefined) {
  const executed: { sql: string; params: unknown[] }[] = [];
  const db = {
    execute: (query: SQL) => {
      const rendered = dialect.sqlToQuery(query);
      executed.push({ sql: rendered.sql, params: rendered.params });
      if (rendered.sql.toLowerCase().startsWith("select")) {
        return Promise.resolve({
          rows: lastSeenAt ? [{ last_seen_at: lastSeenAt.toISOString() }] : [],
        });
      }
      return Promise.resolve({ rows: [] });
    },
  };
  return { db, executed };
}

describe("touchSessionActivity", () => {
  it("accepts a brand new session and records it", async () => {
    const { db, executed } = fakeDb(undefined);

    await expect(
      touchSessionActivity(db as never, SESSION, USER, Date.now()),
    ).resolves.toBeUndefined();

    const upsert = executed.find((e) => /insert\s+into/i.test(e.sql));
    expect(upsert?.params).toContain(SESSION);
    expect(upsert?.params).toContain(USER);
  });

  it("accepts a session seen recently and refreshes the timestamp", async () => {
    const now = Date.now();
    const { db, executed } = fakeDb(new Date(now - 5 * 60_000));

    await touchSessionActivity(db as never, SESSION, USER, now);

    expect(executed.some((e) => /insert\s+into/i.test(e.sql))).toBe(true);
  });

  it("rejects a session idle past the timeout, without refreshing it", async () => {
    const now = Date.now();
    const { db, executed } = fakeDb(new Date(now - IDLE_TIMEOUT_MS - 60_000));

    await expect(
      touchSessionActivity(db as never, SESSION, USER, now),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(executed.some((e) => /insert\s+into/i.test(e.sql))).toBe(false);
  });

  it("accepts a session exactly at the boundary", async () => {
    const now = Date.now();
    const { db } = fakeDb(new Date(now - IDLE_TIMEOUT_MS));

    await expect(
      touchSessionActivity(db as never, SESSION, USER, now),
    ).resolves.toBeUndefined();
  });

  it("fails open and logs when the store is unreachable", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("db down")) };
    const log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    await expect(
      touchSessionActivity(db as never, SESSION, USER, Date.now(), {
        log: log as never,
      }),
    ).resolves.toBeUndefined();

    expect(log.error).toHaveBeenCalled();
  });
});
