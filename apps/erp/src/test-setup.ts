/**
 * Global Vitest setup (PLAN-2026-09-SECURITY-REMEDIATION F6).
 *
 * `~/lib/rate-limit` delegates to the shared limiter in `@cendaro/api`, a
 * lazy singleton that opens a real Postgres connection on first use. Without
 * this, any route test that calls `rateLimit`/`rateLimitComposite`/
 * `applyLockout` (login, create-user, logout, the AI parse endpoint) would
 * fail with "Missing DATABASE_URL" — not because the route is wrong, but
 * because nothing pointed the limiter at a fake store first.
 *
 * A fresh `MemoryRateLimitStore` before every test also keeps limiter state
 * from leaking between tests.
 */
import { beforeEach } from "vitest";

import { MemoryRateLimitStore, setRateLimitStore } from "@cendaro/api";

beforeEach(() => {
  setRateLimitStore(new MemoryRateLimitStore());
});
