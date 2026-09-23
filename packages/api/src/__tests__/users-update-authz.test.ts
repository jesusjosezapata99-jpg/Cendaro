/**
 * users.update authorization (PLAN-2026-09-SECURITY-REMEDIATION F1 review H1,
 * F3.1).
 *
 * Roles and access status are per workspace: the server authorizes with
 * workspace_member (role, and is_workspace_member() only admits active
 * members), so both are written there — never to the global user_profile row
 * another workspace shares. Only owner/admin may edit members, and personal
 * data (name, phone) of someone who also belongs to other workspaces cannot
 * be changed from this one.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { UserProfile, WorkspaceMember } from "@cendaro/db/schema";

import { logger } from "../logger";
import { usersRouter } from "../modules/users";
import { createCallerFactory, createTRPCRouter } from "../trpc";

// Input ids go through z.string().uuid(), which in Zod v4 enforces RFC 4122
// version/variant bits, so these are valid v4 UUIDs.
const WORKSPACE = "00000000-0000-4000-8000-0000000000f1";
const TARGET = "00000000-0000-4000-8000-0000000000f9";

interface Write {
  table: "workspace_member" | "user_profile" | "audit_log";
  values: Record<string, unknown>;
}

let callerCounter = 0;

/** A fresh caller id per test keeps the process-wide membership cache out of the way. */
function nextCallerId(): string {
  callerCounter += 1;
  return `00000000-0000-4000-8000-${String(callerCounter).padStart(12, "0")}`;
}

function tableName(table: unknown): Write["table"] {
  if (table === WorkspaceMember) return "workspace_member";
  if (table === UserProfile) return "user_profile";
  return "audit_log";
}

const dialect = new PgDialect();

interface FakeOptions {
  callerRole: string;
  targetRole: string | null;
  targetStatus?: string;
  /** Workspaces the target belongs to (active or suspended), including this one. */
  memberships?: number;
  /** workspace_quota.max_users (negative = unlimited). */
  maxUsers?: number;
  /** Active members counted when a suspended member is reactivated. */
  activeMembers?: number;
}

function fakeDb(opts: FakeOptions) {
  const writes: Write[] = [];
  const executed: string[] = [];

  const select = (shape: Record<string, unknown>) => {
    const rows =
      "plan" in shape
        ? [{ plan: "pro" }]
        : "fullName" in shape
          ? [{ fullName: "Caller" }]
          : "maxUsers" in shape
            ? [{ maxUsers: opts.maxUsers ?? -1 }]
            : "count" in shape
              ? [{ count: opts.activeMembers ?? 0 }]
              : "role" in shape
                ? opts.targetRole
                  ? [
                      {
                        role: opts.targetRole,
                        status: opts.targetStatus ?? "active",
                      },
                    ]
                  : []
                : [{ status: "active" }];
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      for: () => chain,
      then: (
        onFulfilled: (value: unknown[]) => unknown,
        onRejected: (reason: unknown) => unknown,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const tx = {
    execute: (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      executed.push(text);
      return Promise.resolve({
        rows: text.includes("user_membership_count")
          ? [{ memberships: opts.memberships ?? 1 }]
          : [],
      });
    },
    select,
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        writes.push({ table: tableName(table), values });
        const where = {
          returning: () => Promise.resolve([{ id: TARGET, ...values }]),
          then: (ok: (v: unknown) => unknown) => Promise.resolve().then(ok),
        };
        return { where: () => where };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        writes.push({ table: tableName(table), values });
        return Promise.resolve();
      },
    }),
  };

  const db = {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: "m0000000-0000-0000-0000-0000000000f1",
            member_role: opts.callerRole,
            member_status: "active",
          },
        ],
      }),
    select,
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  return { db, writes, executed };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ users: usersRouter }),
);

function callerFor(
  callerRole: string,
  targetRole: string | null,
  callerId = nextCallerId(),
  extra: Partial<FakeOptions> = {},
) {
  const { db, writes, executed } = fakeDb({
    callerRole,
    targetRole,
    ...extra,
  });
  const caller = createCaller({
    user: { id: callerId, email: "caller@example.com" },
    db: db as never,
    requestId: "req-users-update",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-users-update" }),
    workspaceId: WORKSPACE,
  });
  return { caller, writes, executed, callerId };
}

const forbidden = expect.objectContaining({ code: "FORBIDDEN" }) as Error;

describe("users.update authorization", () => {
  // A plain profile edit on an employee target: only the caller-role check
  // can reject it (no role change, no privileged target involved).
  it.each(["supervisor", "employee", "vendor", "marketing"])(
    "rejects a %s caller without writing anything",
    async (role) => {
      const { caller, writes } = callerFor(role, "employee");

      await expect(
        caller.users.update({ id: TARGET, fullName: "Cambio Indebido" }),
      ).rejects.toThrowError(forbidden);
      expect(writes).toEqual([]);
    },
  );

  it("returns NOT_FOUND for a user outside the workspace", async () => {
    const { caller, writes } = callerFor("owner", null);

    await expect(
      caller.users.update({ id: TARGET, fullName: "X" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it.each(["owner", "admin"] as const)(
    "forbids an admin from assigning the %s role",
    async (role) => {
      const { caller, writes } = callerFor("admin", "employee");

      await expect(
        caller.users.update({ id: TARGET, role }),
      ).rejects.toThrowError(forbidden);
      expect(writes).toEqual([]);
    },
  );

  it.each(["owner", "admin"])(
    "forbids an admin from modifying a %s target at all",
    async (targetRole) => {
      const { caller, writes } = callerFor("admin", targetRole);

      await expect(
        caller.users.update({ id: TARGET, status: "suspended" }),
      ).rejects.toThrowError(forbidden);
      expect(writes).toEqual([]);
    },
  );

  it("forbids changing your own role", async () => {
    const { caller, writes, callerId } = callerFor("owner", "owner");

    await expect(
      caller.users.update({ id: callerId, role: "employee" }),
    ).rejects.toThrowError(forbidden);
    expect(writes).toEqual([]);
  });

  // Defense in depth: with consistent data the peer-owner and privileged-target
  // rules already stop self role changes, so this isolates the self check with
  // a membership row that disagrees with the caller's resolved role.
  it("forbids a self role change even when the other rules would allow it", async () => {
    const { caller, writes, callerId } = callerFor("owner", "employee");

    await expect(
      caller.users.update({ id: callerId, role: "supervisor" }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "No puedes cambiar tu propio rol",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("forbids an owner from changing another owner's role", async () => {
    const { caller, writes } = callerFor("owner", "owner");

    await expect(
      caller.users.update({ id: TARGET, role: "admin" }),
    ).rejects.toThrowError(forbidden);
    expect(writes).toEqual([]);
  });

  it("writes an owner's role change to workspace_member and mirrors it on the profile", async () => {
    const { caller, writes } = callerFor("owner", "employee");

    await caller.users.update({ id: TARGET, role: "supervisor" });

    expect(writes.map((w) => w.table)).toEqual([
      "workspace_member",
      "user_profile",
      "audit_log",
    ]);
    expect(writes[0]?.values).toEqual({ role: "supervisor" });
    expect(writes[1]?.values).toEqual({ role: "supervisor" });
    expect(writes[2]?.values).toMatchObject({
      workspaceId: WORKSPACE,
      action: "user.update",
      actorRole: "owner",
      oldValue: { memberRole: "employee", memberStatus: "active" },
      newValue: { role: "supervisor" },
    });
  });

  it("lets an admin edit an employee's profile fields without touching the membership", async () => {
    const { caller, writes } = callerFor("admin", "employee");

    await caller.users.update({ id: TARGET, fullName: "Nuevo Nombre" });

    expect(writes.map((w) => w.table)).toEqual(["user_profile", "audit_log"]);
    expect(writes[0]?.values).toEqual({ fullName: "Nuevo Nombre" });
  });

  it("treats re-sending the current role as no role change", async () => {
    const { caller, writes, callerId } = callerFor("owner", "owner");

    await caller.users.update({ id: callerId, role: "owner", phone: "123" });

    expect(writes.map((w) => w.table)).toEqual(["user_profile", "audit_log"]);
    expect(writes[0]?.values).toEqual({ phone: "123" });
  });
});

describe("users.update access status (F3.1)", () => {
  it("suspends access in this workspace only, on the membership", async () => {
    const { caller, writes } = callerFor("admin", "employee");

    await caller.users.update({ id: TARGET, status: "suspended" });

    expect(writes.map((w) => w.table)).toEqual([
      "workspace_member",
      "audit_log",
    ]);
    expect(writes[0]?.values).toEqual({ status: "suspended" });
    expect(writes[1]?.values).toMatchObject({
      oldValue: { memberRole: "employee", memberStatus: "active" },
      newValue: { status: "suspended" },
    });
  });

  it("reactivates a suspended member", async () => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      targetStatus: "suspended",
    });
    await caller.users.update({ id: TARGET, status: "active" });
    expect(writes[0]).toEqual({
      table: "workspace_member",
      values: { status: "active" },
    });
  });

  // A suspended member holds no seat, so reactivating takes one back; the
  // enforce_workspace_quota trigger only fires on INSERT and misses this.
  it("refuses to reactivate when the plan has no free seat", async () => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      targetStatus: "suspended",
      maxUsers: 3,
      activeMembers: 3,
    });
    await expect(
      caller.users.update({ id: TARGET, status: "active" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("does not spend a seat check when suspending", async () => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      maxUsers: 1,
      activeMembers: 9,
    });
    await caller.users.update({ id: TARGET, status: "suspended" });
    expect(writes[0]?.values).toEqual({ status: "suspended" });
  });

  it("rejects the old global statuses", async () => {
    const { caller, writes } = callerFor("owner", "employee");
    await expect(
      caller.users.update({ id: TARGET, status: "inactive" } as never),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("does not let a pending or removed membership be activated here", async () => {
    for (const targetStatus of ["invited", "removed"]) {
      const { caller, writes } = callerFor("owner", "employee", undefined, {
        targetStatus,
      });
      await expect(
        caller.users.update({ id: TARGET, status: "active" }),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
      );
      expect(writes).toEqual([]);
    }
  });

  it("forbids an owner from suspending another owner (peer protection)", async () => {
    const { caller, writes } = callerFor("owner", "owner");
    await expect(
      caller.users.update({ id: TARGET, status: "suspended" }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "No puedes suspender a otro dueño",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("forbids suspending yourself", async () => {
    const { caller, writes, callerId } = callerFor("owner", "owner");
    await expect(
      caller.users.update({ id: callerId, status: "suspended" }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "No puedes cambiar tu propio estado de acceso",
      }) as Error,
    );
    expect(writes).toEqual([]);
  });
});

describe("users.update on memberships without access (F3.1 review)", () => {
  // A removed member or an unaccepted invitation is not a current
  // relationship: it must not let this workspace touch the shared profile.
  it.each([
    ["invited", { fullName: "Renombrado" }],
    ["removed", { fullName: "Renombrado" }],
    ["removed", { phone: "0412" }],
    ["suspended", { phone: "0412" }],
    ["invited", { role: "supervisor" as const }],
    ["removed", { role: "supervisor" as const }],
  ])("refuses to change a %s member (%o)", async (targetStatus, changes) => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      targetStatus,
    });
    await expect(
      caller.users.update({ id: TARGET, ...changes }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("still manages the role of a suspended member", async () => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      targetStatus: "suspended",
    });
    await caller.users.update({ id: TARGET, role: "supervisor" });
    expect(writes.map((w) => w.table)).toEqual([
      "workspace_member",
      "audit_log",
    ]);
  });
});

describe("users.update personal data across workspaces (F3.1)", () => {
  it("forbids editing name or phone of someone in other workspaces", async () => {
    const { caller, writes, executed } = callerFor(
      "owner",
      "employee",
      undefined,
      { memberships: 2 },
    );

    await expect(
      caller.users.update({ id: TARGET, fullName: "Nombre Ajeno" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
    expect(
      executed.some((text) => text.includes("user_membership_count")),
    ).toBe(true);
  });

  it("still lets that member's role and status be managed here", async () => {
    const { caller, writes } = callerFor("owner", "employee", undefined, {
      memberships: 2,
    });
    await caller.users.update({
      id: TARGET,
      role: "supervisor",
      status: "suspended",
    });
    expect(writes.map((w) => w.table)).toEqual([
      "workspace_member",
      "audit_log",
    ]);
    expect(writes[0]?.values).toEqual({
      role: "supervisor",
      status: "suspended",
    });
  });

  it("lets a member edit their own personal data from any workspace", async () => {
    const { caller, writes, callerId } = callerFor(
      "owner",
      "owner",
      undefined,
      {
        memberships: 3,
      },
    );
    await caller.users.update({ id: callerId, phone: "0414" });
    expect(writes[0]).toEqual({
      table: "user_profile",
      values: { phone: "0414" },
    });
  });
});
