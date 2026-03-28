/**
 * Cendaro — In-Memory Sliding Window Rate Limiter
 *
 * Zero-dependency, serverless-compatible rate limiter for API routes.
 * Uses a Map<string, number[]> to track request timestamps per key (IP).
 *
 * Characteristics:
 *   • Sliding window — counts requests within the last `window` ms
 *   • Self-cleaning — prunes expired entries on each call
 *   • No external deps — works on Vercel Serverless without Redis
 *
 * Limitation: Resets on cold starts (acceptable for serverless).
 * For persistent rate limiting, migrate to @upstash/ratelimit.
 */

interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
}

interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  window?: number;
  /** Maximum requests per window (default: 5) */
  max?: number;
}

// Module-scoped store — persists across requests within the same instance
const store = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks from abandoned keys
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function pruneStore(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  const cutoff = now - windowMs;

  for (const [key, timestamps] of store) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}

/**
 * Check rate limit for a given key (typically client IP).
 *
 * @param key - Identifier to rate-limit (e.g. IP address)
 * @param opts - Window duration (ms) and max requests
 * @returns Whether the request is allowed, remaining quota, and reset time
 *
 * @example
 * ```ts
 * const ip = request.headers.get("x-forwarded-for") ?? "unknown";
 * const { success, remaining, reset } = rateLimit(ip, { window: 60_000, max: 5 });
 * if (!success) {
 *   return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
 *   });
 * }
 * ```
 */
export function rateLimit(
  key: string,
  opts?: RateLimitOptions,
): RateLimitResult {
  const windowMs = opts?.window ?? 60_000;
  const max = opts?.max ?? 5;
  const now = Date.now();
  const cutoff = now - windowMs;

  // Prune global store periodically
  pruneStore(windowMs);

  // Get or initialize timestamps for this key
  const timestamps = store.get(key) ?? [];

  // Filter to only timestamps within the current window
  const valid = timestamps.filter((t) => t > cutoff);

  // Calculate reset time from the oldest valid timestamp
  const oldestInWindow = valid[0];
  const reset = oldestInWindow ? oldestInWindow + windowMs : now + windowMs;

  if (valid.length >= max) {
    // Over limit — update store with pruned timestamps but don't add new one
    store.set(key, valid);
    return { success: false, remaining: 0, reset };
  }

  // Under limit — record this request
  valid.push(now);
  store.set(key, valid);

  return { success: true, remaining: max - valid.length, reset };
}
