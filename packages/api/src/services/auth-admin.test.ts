/**
 * Session revocation when someone loses their last active access
 * (PLAN-2026-09-SECURITY-REMEDIATION F5.2, finding H5).
 *
 * Deactivating a member used to leave their refresh token working: the next
 * refresh minted a new access token, so the session survived the removal.
 * These procedures delete the GoTrue sessions of a person who no longer holds
 * any active membership in any active workspace.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { revokeSessionsIfAccessLost, revokeUserSessions } from "./auth-admin";

const USER = "00000000-0000-4000-8000-000000000001";

const dialect = new PgDialect({ casing: "snake_case" });

function fakeDb(options: { hasAccess: boolean; deleted?: number }) {
  const executed: { sql: string; params: unknown[] }[] = [];
  const db = {
    execute: (query: SQL) => {
      const rendered = dialect.sqlToQuery(query);
      executed.push({ sql: rendered.sql, params: rendered.params });
      if (rendered.sql.includes("workspace_member")) {
        return Promise.resolve({ rows: options.hasAccess ? [{ ok: 1 }] : [] });
      }
      return Promise.resolve({
        rows: Array.from({ length: options.deleted ?? 0 }, () => ({
          id: "session",
        })),
      });
    },
  };
  return { db, executed };
}

describe("revokeUserSessions", () => {
  it("deletes the sessions and refresh tokens of one user", async () => {
    const { db, executed } = fakeDb({ hasAccess: false, deleted: 2 });

    const revoked = await revokeUserSessions(db as never, USER);

    expect(revoked).toBe(2);
    const statements = executed.map((e) => e.sql);
    expect(
      statements.some((s) => /delete\s+from\s+auth\.sessions/i.test(s)),
    ).toBe(true);
    expect(
      statements.some((s) => /delete\s+from\s+auth\.refresh_tokens/i.test(s)),
    ).toBe(true);
    // The id is always a bound parameter, never inlined into the statement.
    for (const entry of executed) {
      expect(entry.params).toContain(USER);
      expect(entry.sql).not.toContain(USER);
    }
  });
});

describe("revokeSessionsIfAccessLost", () => {
  it("keeps the sessions while any active membership remains", async () => {
    const { db, executed } = fakeDb({ hasAccess: true });

    const result = await revokeSessionsIfAccessLost(db as never, USER);

    expect(result).toEqual({ keptAccess: true, revoked: 0 });
    expect(executed.every((e) => !/delete/i.test(e.sql))).toBe(true);
  });

  it("revokes once the last active access is gone", async () => {
    const { db } = fakeDb({ hasAccess: false, deleted: 1 });

    const result = await revokeSessionsIfAccessLost(db as never, USER);

    expect(result).toEqual({ keptAccess: false, revoked: 1 });
  });

  it("only counts memberships of an active profile in an active workspace", async () => {
    const { db, executed } = fakeDb({ hasAccess: true });

    await revokeSessionsIfAccessLost(db as never, USER);

    const check = executed[0]?.sql ?? "";
    expect(check).toMatch(/user_profile/);
    expect(check).toMatch(/workspace/);
    // snake_case identifiers only — the DB has no camelCase columns.
    expect(check).not.toMatch(/"[a-z]+[A-Z]/);
  });

  it("never lets a revocation failure break the caller", async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error("auth schema unreachable")),
    };
    const log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    const result = await revokeSessionsIfAccessLost(db as never, USER, {
      log: log as never,
    });

    expect(result).toEqual({ keptAccess: false, revoked: 0, failed: true });
    expect(log.error).toHaveBeenCalled();
  });
});
