/**
 * Cendaro — Hardened In-Memory Rate Limiter
 *
 * Sliding-window rate limiter with multi-key composite support,
 * per-username hard lockout, and automatic store cleanup.
 *
 * Strategy:
 *   • rateLimit(key, opts)            — single key check (IP, etc.)
 *   • rateLimitComposite(keys, opts)   — all keys checked atomically
 *   • lockout(key, durationMs)         — hard time-based block (e.g. after N failures)
 *   • isLockedOut(key)                 — check hard lockout status
 *
 * Design constraints:
 *   • Zero dependencies — no Redis, no Upstash
 *   • Serverless-compatible (module-scoped Map)
 *   • Resets on cold starts — acceptable for in-memory tier
 *   • Periodic self-cleaning to prevent unbounded memory growth
 *
 * Migration path: swap rateLimit() calls with @upstash/ratelimit for
 * persistent cross-instance rate limiting when scaling horizontally.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** Whether the request is allowed to proceed */
  success: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
  /** Which key triggered the block (composite mode) */
  blockedBy?: string;
}

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 min) */
  window?: number;
  /** Maximum requests allowed per window (default: 5) */
  max?: number;
}

// ── Internal state ─────────────────────────────────────────────────────────

/** Sliding-window timestamp store: key → sorted list of request timestamps */
const windowStore = new Map<string, number[]>();

/** Hard lockout store: key → unlock timestamp */
const lockoutStore = new Map<string, number>();

/** Cleanup runs at most once per 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;
let lastCleanup = Date.now();

// ── Internal helpers ───────────────────────────────────────────────────────

function pruneStores(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;

  for (const [key, timestamps] of windowStore) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) windowStore.delete(key);
    else windowStore.set(key, valid);
  }

  for (const [key, unlockAt] of lockoutStore) {
    if (now >= unlockAt) lockoutStore.delete(key);
  }
}

function checkWindow(
  key: string,
  windowMs: number,
  max: number,
  now: number,
): RateLimitResult & { _valid: number[] } {
  const cutoff = now - windowMs;
  const timestamps = windowStore.get(key) ?? [];
  const valid = timestamps.filter((t) => t > cutoff);

  const oldest = valid[0];
  const reset = oldest ? oldest + windowMs : now + windowMs;

  if (valid.length >= max) {
    windowStore.set(key, valid);
    return { success: false, remaining: 0, reset, _valid: valid };
  }

  return {
    success: true,
    remaining: max - valid.length - 1,
    reset,
    _valid: valid,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check rate limit for a single key (e.g. IP address).
 * Records the request if allowed.
 *
 * @example
 * const { success, reset } = rateLimit(`login:${ip}`, { window: 60_000, max: 5 });
 */
export function rateLimit(
  key: string,
  opts?: RateLimitOptions,
): RateLimitResult {
  const windowMs = opts?.window ?? 60_000;
  const max = opts?.max ?? 5;
  const now = Date.now();

  pruneStores(windowMs);

  // Check hard lockout first (fastest path)
  const lockUntil = lockoutStore.get(key);
  if (lockUntil && now < lockUntil) {
    return { success: false, remaining: 0, reset: lockUntil };
  }

  const result = checkWindow(key, windowMs, max, now);

  if (result.success) {
    result._valid.push(now);
    windowStore.set(key, result._valid);
  }

  const { _valid: _, ...publicResult } = result;
  return publicResult;
}

/**
 * Check multiple rate-limit keys atomically.
 * ALL keys must pass — the first failure blocks the request.
 * Records the request on ALL passing keys only if ALL pass.
 *
 * Used for dual-vector auth protection:
 *   key[0] = `login:ip:${ip}`       — per-IP rolling window
 *   key[1] = `login:user:${user}`   — per-username rolling window
 *
 * @example
 * const { success, blockedBy } = rateLimitComposite(
 *   [{ key: `login:ip:${ip}`, window: 60_000, max: 5 },
 *    { key: `login:user:${username}`, window: 900_000, max: 10 }]
 * );
 */
export interface CompositeKey {
  key: string;
  window?: number;
  max?: number;
}

export function rateLimitComposite(keys: CompositeKey[]): RateLimitResult {
  const now = Date.now();
  pruneStores(60_000);

  const checks: { key: string; result: ReturnType<typeof checkWindow> }[] = [];

  let worstReset = 0;

  for (const { key, window: windowMs = 60_000, max = 5 } of keys) {
    // Hard lockout check
    const lockUntil = lockoutStore.get(key);
    if (lockUntil && now < lockUntil) {
      return { success: false, remaining: 0, reset: lockUntil, blockedBy: key };
    }

    const result = checkWindow(key, windowMs, max, now);
    checks.push({ key, result });

    if (!result.success) {
      return {
        success: false,
        remaining: 0,
        reset: result.reset,
        blockedBy: key,
      };
    }

    if (result.reset > worstReset) worstReset = result.reset;
  }

  // All keys passed — record the request on all of them
  for (const { key, result } of checks) {
    result._valid.push(now);
    windowStore.set(key, result._valid);
  }

  const minRemaining = Math.min(...checks.map((c) => c.result.remaining));
  return { success: true, remaining: minRemaining, reset: worstReset };
}

/**
 * Apply a hard time-based lockout to a key.
 * Overrides the sliding window — nothing can unblock until the duration expires.
 *
 * Use after N consecutive failures to enforce a cool-down period.
 *
 * @param key - Key to lock (e.g. `lockout:user:${username}`)
 * @param durationMs - Lock duration in milliseconds
 */
export function applyLockout(key: string, durationMs: number): void {
  const unlockAt = Date.now() + durationMs;
  lockoutStore.set(key, unlockAt);
}

/**
 * Check if a key is currently hard-locked out.
 * Returns the unlock timestamp (ms) if locked, or null if free.
 */
export function getLockoutExpiry(key: string): number | null {
  const unlockAt = lockoutStore.get(key);
  if (!unlockAt) return null;
  if (Date.now() >= unlockAt) {
    lockoutStore.delete(key);
    return null;
  }
  return unlockAt;
}

/**
 * Get the current failure count for a sliding-window key without recording a request.
 * Used to check if a lockout threshold has been reached.
 */
export function getFailureCount(key: string, windowMs = 900_000): number {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = windowStore.get(key) ?? [];
  return timestamps.filter((t) => t > cutoff).length;
}

/**
 * Record a failed attempt for a key without applying the rate-limit check.
 * Use this to count auth failures independently from the request rate.
 */
export function recordFailure(key: string): void {
  const now = Date.now();
  const timestamps = windowStore.get(key) ?? [];
  timestamps.push(now);
  windowStore.set(key, timestamps);
}
