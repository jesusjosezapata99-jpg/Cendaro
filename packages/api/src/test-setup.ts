/**
 * Global Vitest setup (PLAN-2026-09-SECURITY-REMEDIATION F6).
 *
 * The rate limiter is a lazy singleton (`getRateLimitStore()`) that opens a
 * real Postgres connection on first use. Without this, any test that
 * exercises a procedure calling into the limiter (search, login, create-user)
 * would fail with "Missing DATABASE_URL" the moment it ran in CI or on a
 * machine without a local database — not because the code under test is
 * wrong, but because nothing pointed the limiter at a fake store first.
 *
 * A fresh `MemoryRateLimitStore` before every test keeps limiter state from
 * leaking between tests (two tests hammering the same key in the same
 * process would otherwise see each other's counters).
 */
import { beforeEach } from "vitest";

import { MemoryRateLimitStore, setRateLimitStore } from "./services/rate-limit";

beforeEach(() => {
  setRateLimitStore(new MemoryRateLimitStore());
});
