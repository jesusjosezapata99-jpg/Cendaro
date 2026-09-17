/**
 * users.update authorization (PLAN-2026-09-SECURITY-REMEDIATION F1 review H1).
 *
 * Roles are per workspace: the server authorizes with workspace_member.role,
 * so a role change must be written there (user_profile.role is display only),
 * and only owner/admin may edit members.
 */
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

function fakeDb(opts: { callerRole: string; targetRole: string | null }) {
  const writes: Write[] = [];

  const select = (shape: Record<string, unknown>) => {
    const rows =
      "plan" in shape
        ? [{ plan: "pro" }]
        : "fullName" in shape
          ? [{ fullName: "Caller" }]
          : "role" in shape
            ? opts.targetRole
              ? [{ role: opts.targetRole }]
              : []
            : [{ status: "active" }];
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  };

  const tx = {
    execute: () => Promise.resolve({ rows: [] }),
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

  return { db, writes };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ users: usersRouter }),
);

function callerFor(
  callerRole: string,
  targetRole: string | null,
  callerId = nextCallerId(),
) {
  const { db, writes } = fakeDb({ callerRole, targetRole });
  const caller = createCaller({
    user: { id: callerId, email: "caller@example.com" },
    db: db as never,
    requestId: "req-users-update",
    log: logger.child({ requestId: "req-users-update" }),
    workspaceId: WORKSPACE,
  });
  return { caller, writes, callerId };
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
        caller.users.update({ id: TARGET, status: "inactive" }),
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
      oldValue: { memberRole: "employee", status: "active" },
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
