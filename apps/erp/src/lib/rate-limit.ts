/**
 * Cendaro — Rate limiting for route handlers
 *
 * Thin wrapper over the shared store in `@cendaro/api`
 * (PLAN-2026-09-SECURITY-REMEDIATION F6). The counters used to live in a
 * module-scoped Map here, which on Vercel means one counter per serverless
 * instance: a burst spread over cold starts got the allowance several times
 * over, and every deploy cleared every lockout. They now live in Postgres
 * (migration 019) and are shared by every instance, with this instance's
 * memory as the fallback when the database is unreachable.
 *
 * Every function is async — it talks to the database. They must be called
 * from route handlers or from tRPC code running on the pooled `postgres`
 * connection, never inside the workspace RLS transaction (`app_user` has no
 * privileges on the limiter tables).
 */
import type { RateLimitResult, RateLimitRule } from "@cendaro/api";
import { getRateLimitStore } from "@cendaro/api";

export type { RateLimitResult, RateLimitRule };

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 min) */
  window?: number;
  /** Maximum requests allowed per window (default: 5) */
  max?: number;
}

export interface CompositeKey {
  key: string;
  window?: number;
  max?: number;
}

function toRule({
  key,
  window = 60_000,
  max = 5,
}: CompositeKey): RateLimitRule {
  return { key, windowMs: window, max };
}

/**
 * Checks and charges a single key.
 *
 * @example
 * const { success, reset } = await rateLimit(`login:${ip}`, { window: 60_000, max: 5 });
 */
export function rateLimit(
  key: string,
  opts?: RateLimitOptions,
): Promise<RateLimitResult> {
  return getRateLimitStore().consume([toRule({ key, ...opts })], Date.now());
}

/**
 * Checks several keys at once. All must pass; when one rejects, none is
 * charged, so a request refused by the username rule does not also spend the
 * IP budget.
 *
 * @example
 * const { success, blockedBy } = await rateLimitComposite([
 *   { key: `login:ip:${ip}`, window: 60_000, max: 5 },
 *   { key: `login:user:${username}`, window: 900_000, max: 10 },
 * ]);
 */
export function rateLimitComposite(
  keys: CompositeKey[],
): Promise<RateLimitResult> {
  return getRateLimitStore().consume(keys.map(toRule), Date.now());
}

/**
 * Blocks a key outright until the duration expires, whatever its request
 * window says. Used after repeated authentication failures.
 */
export function applyLockout(
  key: string,
  durationMs: number,
  reason?: string,
): Promise<void> {
  return getRateLimitStore().lock(key, Date.now() + durationMs, reason);
}

/** When a key stops being blocked (unix ms), or null if it is free. */
export function getLockoutExpiry(key: string): Promise<number | null> {
  return getRateLimitStore().lockedUntil(key, Date.now());
}

/** Counts an event (a failed login) without spending the request budget. */
export function recordFailure(key: string, windowMs = 900_000): Promise<void> {
  return getRateLimitStore().recordFailure(key, windowMs, Date.now());
}

/** How many events a key has recorded in the window, without charging one. */
export function getFailureCount(
  key: string,
  windowMs = 900_000,
): Promise<number> {
  return getRateLimitStore().count(key, windowMs, Date.now());
}
