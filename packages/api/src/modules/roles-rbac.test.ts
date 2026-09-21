import { TRPCError } from "@trpc/server";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type {
  ErpModule,
  PermissionAction,
  UserRole,
} from "@cendaro/validators";
import { can, NAV_ROLE_RULES, USER_ROLES } from "@cendaro/validators";

import { sampleInput } from "../__tests__/helpers/sample-input";
import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

describe("RBAC Role Security and Invariants (C4)", () => {
  it("defines all 6 canonical user roles without unexpected additions", () => {
    expect(USER_ROLES).toEqual([
      "owner",
      "admin",
      "supervisor",
      "employee",
      "vendor",
      "marketing",
    ]);
  });

  it("strictly restricts settings, users, and audit to owner and admin only", () => {
    expect(NAV_ROLE_RULES.settings).toEqual(["owner", "admin"]);
    expect(NAV_ROLE_RULES.users).toEqual(["owner", "admin"]);
    expect(NAV_ROLE_RULES.audit).toEqual(["owner", "admin"]);
  });

  it("prohibits vendor and marketing from accessing point of sale or finance closures", () => {
    expect(NAV_ROLE_RULES.pos).not.toContain("vendor");
    expect(NAV_ROLE_RULES.pos).not.toContain("marketing");

    expect(NAV_ROLE_RULES.cashClosure).not.toContain("vendor");
    expect(NAV_ROLE_RULES.cashClosure).not.toContain("marketing");
    expect(NAV_ROLE_RULES.cashClosure).not.toContain("employee");
  });

  it("prohibits employee, vendor and marketing from managing rates or inventory", () => {
    expect(NAV_ROLE_RULES.rates).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.inventory).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.containers).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.pricing).toEqual(["owner", "admin", "supervisor"]);
  });

  it("allows marketing access exclusively to marketplace and public/catalog modules", () => {
    expect(NAV_ROLE_RULES.marketplace).toContain("marketing");
    expect(NAV_ROLE_RULES.settings).not.toContain("marketing");
    expect(NAV_ROLE_RULES.payments).not.toContain("marketing");
    expect(NAV_ROLE_RULES.users).not.toContain("marketing");
  });
});

/**
 * The tests above only pin the CLIENT navigation table. This block calls the
 * REAL router, once per role, for every permission-gated read procedure and
 * checks the server answers FORBIDDEN exactly where the matrix says no —
 * the enforcement that actually protects data (PLAN-2026-09-SECURITY-
 * REMEDIATION F9.5, finding L5). The database is a stub: authorization runs
 * before any handler, so no SQL result can change the verdict.
 */
interface AuthzMeta {
  kind: string;
  module?: ErpModule;
  action?: PermissionAction;
}

const TABLE_ROWS: Record<string, Record<string, unknown>[]> = {
  workspace: [{ plan: "enterprise" }],
  user_profile: [{ fullName: "QA" }],
  workspace_module: [{ id: "module-enabled" }],
};

function fakeDb(role: UserRole) {
  const chain = (table: string): unknown => {
    const rows = TABLE_ROWS[table] ?? [];
    const self: unknown = new Proxy(() => undefined, {
      get: (_target, prop) =>
        prop === "then"
          ? (ok: (value: unknown[]) => unknown) =>
              Promise.resolve(rows).then(ok)
          : () => self,
      apply: () => self,
    });
    return self;
  };

  const tableName = (t: unknown): string => {
    try {
      return getTableConfig(t as never).name;
    } catch {
      return "";
    }
  };

  const base = {
    execute: (query: unknown) => {
      const text = JSON.stringify(query);
      if (text.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: [
            {
              member_id: "00000000-0000-4000-8000-0000000000e3",
              member_role: role,
              member_status: "active",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
    select: () => ({ from: (t: unknown) => chain(tableName(t)) }),
  };
  return {
    ...base,
    transaction: (fn: (tx: typeof base) => unknown) => fn(base),
  };
}

describe("server enforces the permission matrix on every read procedure (F9.5)", () => {
  const createCaller = createCallerFactory(appRouter);

  const gated = Object.entries(
    appRouter._def.procedures as unknown as Record<
      string,
      {
        _def: {
          type: string;
          inputs?: unknown[];
          meta?: { authz?: AuthzMeta };
        };
      }
    >,
  )
    .filter(([, p]) => p._def.type === "query")
    .flatMap(([path, p]) => {
      const authz = p._def.meta?.authz;
      return authz?.kind === "permission" && authz.module && authz.action
        ? [{ path, procedure: p, module: authz.module, action: authz.action }]
        : [];
    });

  it("covers the whole gated read surface", () => {
    // A floor: if this drops, procedures stopped declaring their permission.
    expect(gated.length).toBeGreaterThanOrEqual(40);
  });

  it.each(USER_ROLES)("answers %s exactly as the matrix says", async (role) => {
    const caller = createCaller({
      user: {
        id: "00000000-0000-4000-8000-0000000000c1",
        email: "actor@example.invalid",
        aal: "aal2",
        sessionId: null,
      },
      db: fakeDb(role) as never,
      requestId: `req-rbac-${role}`,
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: `req-rbac-${role}` }),
      workspaceId: "00000000-0000-4000-8000-0000000000e1",
    }) as unknown as Record<string, unknown>;

    const mismatches: string[] = [];

    for (const { path, procedure, module, action } of gated) {
      const fn = path
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          caller,
        );

      let forbidden = false;
      try {
        await (fn as (input: unknown) => Promise<unknown>)(
          sampleInput(procedure),
        );
      } catch (error) {
        forbidden = error instanceof TRPCError && error.code === "FORBIDDEN";
      }

      const allowed = can(role, module, action);
      if (forbidden === allowed) {
        mismatches.push(
          `${path} (${module}.${action}): ${role} ${allowed ? "should be allowed but got FORBIDDEN" : "should be FORBIDDEN but was answered"}`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });
});
