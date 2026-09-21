/**
 * Shared rate limiter (PLAN-2026-09-SECURITY-REMEDIATION F6, finding M1).
 *
 * The previous limiter kept its counters in a module-scoped Map. On Vercel
 * that means one counter per serverless instance: a burst spread over cold
 * starts got the full allowance several times over, and every deploy wiped
 * every lockout. Counters now live in Postgres (migration 019), shared by all
 * instances.
 *
 * Algorithm — sliding window counter: one row per key per fixed window, and a
 * request is weighted against the previous window in proportion to how far the
 * current one has advanced. One row per key per window instead of one row per
 * request, without the double-burst edge of a plain fixed window.
 *
 * `RateLimitStore` is the seam: production uses `PostgresRateLimitStore`,
 * tests and development use `MemoryRateLimitStore`, and moving to Upstash
 * later means writing one more implementation, not touching any call site.
 *
 * Privileges: the tables are reachable only by roles that bypass RLS, so every
 * call must run on the pooled `postgres` connection — never inside the
 * workspace RLS transaction, where the role is `app_user`.
 */
import { sql } from "drizzle-orm";

import { getDb } from "@cendaro/db/client";

import type { ILogger } from "../logger";
import { logger } from "../logger";

type Db = ReturnType<typeof getDb>;

export interface RateLimitResult {
  /** Whether the request may proceed. */
  success: boolean;
  /** Requests left in the tightest rule of this check. */
  remaining: number;
  /** When the tightest rule frees up, as a unix timestamp in ms. */
  reset: number;
  /** Which key rejected the request. */
  blockedBy?: string;
}

export interface RateLimitRule {
  key: string;
  windowMs: number;
  max: number;
}

export interface RateLimitStore {
  /**
   * Counts one request against every rule. Either all rules are charged, or —
   * when any of them rejects — none is, so a request refused by the username
   * rule does not also spend the IP budget.
   */
  consume(
    rules: readonly RateLimitRule[],
    now: number,
  ): Promise<RateLimitResult>;
  /** Weighted count of a key, without charging a request. */
  count(key: string, windowMs: number, now: number): Promise<number>;
  /** Counts an event (a failed login) outside the request budget. */
  recordFailure(key: string, windowMs: number, now: number): Promise<void>;
  /** Blocks a key until `until` (unix ms). */
  lock(key: string, until: number, reason?: string): Promise<void>;
  /** When the key stops being blocked, or null if it is free. */
  lockedUntil(key: string, now: number): Promise<number | null>;
}

/** Start of the fixed window `now` falls into. */
export function windowStartFor(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * Requests counted against a key: everything in the current window plus the
 * share of the previous one that has not slid out yet.
 */
export function weightedCount(
  previousCount: number,
  currentCount: number,
  elapsedMs: number,
  windowMs: number,
): number {
  const carry = previousCount * (1 - elapsedMs / windowMs);
  return currentCount + Math.max(0, carry);
}

function resultFor(
  rule: RateLimitRule,
  used: number,
  windowStart: number,
): RateLimitResult {
  const reset = windowStart + rule.windowMs;
  if (used > rule.max) {
    return { success: false, remaining: 0, reset, blockedBy: rule.key };
  }
  return { success: true, remaining: Math.max(0, rule.max - used), reset };
}

/** Internal signal used to roll back a composite check, carrying its result. */
class RateLimitRejection extends Error {
  constructor(readonly result: RateLimitResult) {
    super("rate limit exceeded");
  }
}

// ── In-memory store (development, tests, and fallback) ──────────────────────

/**
 * Per-instance store. Correct on a single process, and deliberately kept as
 * the fallback: if the database is unreachable, limiting per instance is much
 * better than not limiting at all.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Map<number, number>>();
  private readonly lockouts = new Map<string, number>();

  private windowsOf(key: string): Map<number, number> {
    let windows = this.buckets.get(key);
    if (!windows) {
      windows = new Map<number, number>();
      this.buckets.set(key, windows);
    }
    return windows;
  }

  private used(key: string, windowMs: number, now: number): number {
    const windowStart = windowStartFor(now, windowMs);
    const windows = this.buckets.get(key);
    if (!windows) return 0;
    return weightedCount(
      windows.get(windowStart - windowMs) ?? 0,
      windows.get(windowStart) ?? 0,
      now - windowStart,
      windowMs,
    );
  }

  private add(key: string, windowMs: number, now: number): void {
    const windowStart = windowStartFor(now, windowMs);
    const windows = this.windowsOf(key);
    windows.set(windowStart, (windows.get(windowStart) ?? 0) + 1);
    for (const start of windows.keys()) {
      if (start < windowStart - windowMs) windows.delete(start);
    }
  }

  async consume(
    rules: readonly RateLimitRule[],
    now: number,
  ): Promise<RateLimitResult> {
    let tightest: RateLimitResult | null = null;

    for (const rule of rules) {
      const lock = await this.lockedUntil(rule.key, now);
      if (lock !== null) {
        return {
          success: false,
          remaining: 0,
          reset: lock,
          blockedBy: rule.key,
        };
      }

      const windowStart = windowStartFor(now, rule.windowMs);
      const result = resultFor(
        rule,
        this.used(rule.key, rule.windowMs, now) + 1,
        windowStart,
      );
      if (!result.success) return result;
      if (!tightest || result.remaining < tightest.remaining) tightest = result;
    }

    for (const rule of rules) this.add(rule.key, rule.windowMs, now);
    return tightest ?? { success: true, remaining: 0, reset: now };
  }

  count(key: string, windowMs: number, now: number): Promise<number> {
    return Promise.resolve(this.used(key, windowMs, now));
  }

  recordFailure(key: string, windowMs: number, now: number): Promise<void> {
    this.add(key, windowMs, now);
    return Promise.resolve();
  }

  lock(key: string, until: number, _reason?: string): Promise<void> {
    // The reason is only kept in Postgres, where it is read when auditing a
    // lockout; in memory it would die with the instance.
    this.lockouts.set(key, until);
    return Promise.resolve();
  }

  lockedUntil(key: string, now: number): Promise<number | null> {
    const until = this.lockouts.get(key);
    if (until === undefined) return Promise.resolve(null);
    if (now >= until) {
      this.lockouts.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(until);
  }
}

// ── Postgres store (production) ─────────────────────────────────────────────

type BucketRow = Record<string, unknown> & {
  current_count: number;
  previous_count: number;
};

/** Rows stop being meaningful two windows after they were written. */
const RETENTION_FACTOR = 2;

export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly db: Db) {}

  /**
   * Charges one request against `rule` inside an open transaction and returns
   * the outcome. The INSERT happens first so two concurrent requests cannot
   * both read the same count; a rejected request is undone by rolling back the
   * whole transaction, which is what `consume` does when any rule fails.
   */
  private async charge(
    tx: Db,
    rule: RateLimitRule,
    now: number,
  ): Promise<RateLimitResult> {
    const windowStart = windowStartFor(now, rule.windowMs);
    const expiresAt = windowStart + rule.windowMs * RETENTION_FACTOR;
    const previousStart = (windowStart - rule.windowMs) / 1000;

    const { rows } = await tx.execute<BucketRow>(sql`
      WITH upsert AS (
        INSERT INTO public.rate_limit_bucket (key, window_start, count, expires_at)
        VALUES (
          ${rule.key},
          to_timestamp(${windowStart / 1000}),
          1,
          to_timestamp(${expiresAt / 1000})
        )
        ON CONFLICT (key, window_start) DO UPDATE
          SET count = rate_limit_bucket.count + 1,
              expires_at = EXCLUDED.expires_at
        RETURNING count
      )
      SELECT
        (SELECT count FROM upsert) AS current_count,
        COALESCE((
          SELECT count FROM public.rate_limit_bucket
          WHERE key = ${rule.key}
            AND window_start = to_timestamp(${previousStart})
        ), 0) AS previous_count
    `);

    const row = rows[0];
    const used = weightedCount(
      Number(row?.previous_count ?? 0),
      Number(row?.current_count ?? 1),
      now - windowStart,
      rule.windowMs,
    );
    return resultFor(rule, used, windowStart);
  }

  async consume(
    rules: readonly RateLimitRule[],
    now: number,
  ): Promise<RateLimitResult> {
    for (const rule of rules) {
      const lock = await this.lockedUntil(rule.key, now);
      if (lock !== null) {
        return {
          success: false,
          remaining: 0,
          reset: lock,
          blockedBy: rule.key,
        };
      }
    }

    // One transaction for the whole composite: a rejection rolls back the
    // charges of the rules that had already passed. The result travels back
    // as the transaction's return value (success) or the thrown rejection's
    // payload (failure) — never through a variable mutated from inside the
    // closure, which is unreliable to read back in the outer scope.
    try {
      return await this.db.transaction(async (tx) => {
        let tightest: RateLimitResult | null = null;
        for (const rule of rules) {
          const result = await this.charge(tx as unknown as Db, rule, now);
          if (!result.success) throw new RateLimitRejection(result);
          if (!tightest || result.remaining < tightest.remaining) {
            tightest = result;
          }
        }
        return tightest ?? { success: true, remaining: 0, reset: now };
      });
    } catch (error) {
      if (error instanceof RateLimitRejection) return error.result;
      throw error;
    }
  }

  async count(key: string, windowMs: number, now: number): Promise<number> {
    const windowStart = windowStartFor(now, windowMs);
    const previousStart = (windowStart - windowMs) / 1000;
    const { rows } = await this.db.execute<BucketRow>(sql`
      SELECT
        COALESCE(MAX(count) FILTER (WHERE window_start = to_timestamp(${windowStart / 1000})), 0) AS current_count,
        COALESCE(MAX(count) FILTER (WHERE window_start = to_timestamp(${previousStart})), 0) AS previous_count
      FROM public.rate_limit_bucket
      WHERE key = ${key}
    `);
    const row = rows[0];
    return weightedCount(
      Number(row?.previous_count ?? 0),
      Number(row?.current_count ?? 0),
      now - windowStart,
      windowMs,
    );
  }

  async recordFailure(
    key: string,
    windowMs: number,
    now: number,
  ): Promise<void> {
    const windowStart = windowStartFor(now, windowMs);
    const expiresAt = windowStart + windowMs * RETENTION_FACTOR;
    await this.db.execute(sql`
      INSERT INTO public.rate_limit_bucket (key, window_start, count, expires_at)
      VALUES (${key}, to_timestamp(${windowStart / 1000}), 1, to_timestamp(${expiresAt / 1000}))
      ON CONFLICT (key, window_start) DO UPDATE
        SET count = rate_limit_bucket.count + 1,
            expires_at = EXCLUDED.expires_at
    `);
  }

  async lock(key: string, until: number, reason?: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO public.rate_limit_lockout (key, locked_until, reason)
      VALUES (${key}, to_timestamp(${until / 1000}), ${reason ?? null})
      ON CONFLICT (key) DO UPDATE
        SET locked_until = GREATEST(rate_limit_lockout.locked_until, EXCLUDED.locked_until),
            reason = EXCLUDED.reason
    `);
  }

  async lockedUntil(key: string, now: number): Promise<number | null> {
    const { rows } = await this.db.execute<{ locked_until: string }>(sql`
      SELECT locked_until FROM public.rate_limit_lockout
      WHERE key = ${key} AND locked_until > to_timestamp(${now / 1000})
      LIMIT 1
    `);
    const until = rows[0]?.locked_until;
    return until ? new Date(until).getTime() : null;
  }

  /** Deletes expired rows. Called opportunistically, never on a hot path. */
  async collectGarbage(): Promise<number> {
    const { rows } = await this.db.execute<{ removed: number }>(
      sql`SELECT public.rate_limit_gc() AS removed`,
    );
    return Number(rows[0]?.removed ?? 0);
  }
}

// ── Resilience ──────────────────────────────────────────────────────────────

/**
 * Uses `primary`, and falls back to `backup` when it throws. Rate limiting is
 * not an authorization decision, so an unreachable database must not lock
 * everyone out; limiting per instance is the degraded mode, and the failure is
 * logged so it does not pass unnoticed.
 */
export function withFallback(
  primary: RateLimitStore,
  backup: RateLimitStore,
  log: ILogger,
): RateLimitStore {
  const run = async <T>(
    operation: string,
    onStore: (store: RateLimitStore) => Promise<T>,
  ): Promise<T> => {
    try {
      return await onStore(primary);
    } catch (error) {
      log.error(
        "rate-limit store unavailable, falling back to this instance",
        { operation },
        error,
      );
      return onStore(backup);
    }
  };

  return {
    consume: (rules, now) => run("consume", (s) => s.consume(rules, now)),
    count: (key, windowMs, now) =>
      run("count", (s) => s.count(key, windowMs, now)),
    recordFailure: (key, windowMs, now) =>
      run("recordFailure", (s) => s.recordFailure(key, windowMs, now)),
    lock: (key, until, reason) =>
      run("lock", (s) => s.lock(key, until, reason)),
    lockedUntil: (key, now) =>
      run("lockedUntil", (s) => s.lockedUntil(key, now)),
  };
}

// ── Shared instance ─────────────────────────────────────────────────────────

let sharedStore: RateLimitStore | null = null;

/**
 * The store every caller should use: Postgres, with this instance's memory as
 * the fallback. Built lazily so importing this module never opens a database
 * connection (route handlers import it at module scope).
 */
export function getRateLimitStore(): RateLimitStore {
  sharedStore ??= withFallback(
    new PostgresRateLimitStore(getDb()),
    new MemoryRateLimitStore(),
    logger,
  );
  return sharedStore;
}

/** Replaces the shared store. For tests only. */
export function setRateLimitStore(store: RateLimitStore | null): void {
  sharedStore = store;
}
