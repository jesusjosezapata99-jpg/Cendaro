/**
 * Workspace creation and invitations (PLAN-2026-09-SECURITY-REMEDIATION F3).
 *
 *  - H3: workspace.create accepted a client-chosen plan and organization, so
 *    anyone authenticated could open an "enterprise" workspace inside another
 *    company's organization. The plan is now always starter, the organization
 *    comes from the caller's profile, and only an existing owner in that
 *    organization may create one — atomically, with an audit entry.
 *  - M7: workspace.inviteMember added existing accounts as active members
 *    without consent, ignored maxUsers and told the caller whether an email
 *    was registered. Invitations are now pending until the invitee accepts,
 *    the response is identical for every email, and the quota counts pending
 *    invitations and is re-checked on acceptance (the quota trigger only fires
 *    on INSERT of an active member).
 */
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { usersRouter } from "../modules/users";
import { workspaceRouter } from "../modules/workspace";
import { createCallerFactory, createTRPCRouter } from "../trpc";

const WORKSPACE = "00000000-0000-4000-8000-0000000000a1";
const ORG = "00000000-0000-4000-8000-0000000000b1";
const OTHER_ORG = "00000000-0000-4000-8000-0000000000b2";
const INVITEE = "00000000-0000-4000-8000-0000000000c1";

type Row = Record<string, unknown>;

interface Write {
  op: "insert" | "update";
  table: string;
  values: Row | Row[];
}

interface Scenario {
  /** Caller's role in WORKSPACE (workspace-scoped procedures). */
  role?: string;
  /** organization_id of the caller's profile. */
  profileOrg?: string | null;
  /** Caller owns an active workspace in their organization. */
  ownsWorkspaceInOrg?: boolean;
  /** workspace_quota.max_users of WORKSPACE (negative = unlimited). */
  maxUsers?: number;
  /** Members counted against the quota. */
  memberCount?: number;
  /** Profile id found for the invited email (null = no such account). */
  inviteeId?: string | null;
  /** Existing membership of the invitee (or of the caller, for accept). */
  existingMember?: { id: string; status: string; role?: string } | null;
  /** Status of the workspace being joined. */
  workspaceStatus?: string;
  /** Error thrown by the workspace insert. */
  workspaceInsertError?: Error;
  /** Table whose insert fails, to prove the transaction rolls everything back. */
  failInsertOn?: string;
}

const dialect = new PgDialect();

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function fakeDb(s: Scenario) {
  const writes: Write[] = [];
  const queries: {
    table: string;
    where: string;
    params: unknown[];
    locked: boolean;
  }[] = [];
  const executed: string[] = [];

  const selectRows = (table: string, shape: Row, where: string): Row[] => {
    if (table === "user_profile") {
      return "organizationId" in shape
        ? [{ organizationId: s.profileOrg ?? null }]
        : [{ fullName: "Caller" }];
    }
    if (table === "workspace_member") {
      if ("count" in shape) return [{ count: s.memberCount ?? 1 }];
      if (where.includes(`"workspace"."organizationId"`)) {
        return s.ownsWorkspaceInOrg ? [{ id: nextId() }] : [];
      }
      return s.existingMember ? [s.existingMember] : [];
    }
    if (table === "workspace_quota") {
      return [{ maxUsers: s.maxUsers ?? 5 }];
    }
    if (table === "workspace") {
      if (where.includes(`"workspace"."slug"`)) return [];
      return [{ plan: "pro", status: s.workspaceStatus ?? "active" }];
    }
    return [];
  };

  const chain = (op: "select" | "insert" | "update", shape: Row = {}) => {
    let table = "";
    let where = "";
    let params: unknown[] = [];
    let locked = false;
    let values: Row | Row[] = {};
    const self: Record<string, unknown> = {};
    for (const method of [
      "innerJoin",
      "leftJoin",
      "orderBy",
      "limit",
      "returning",
      "onConflictDoNothing",
    ]) {
      self[method] = () => self;
    }
    self.from = (t: unknown) => {
      table = getTableConfig(t as never).name;
      return self;
    };
    self.for = () => {
      locked = true;
      return self;
    };
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        where = rendered.sql;
        params = rendered.params;
      }
      return self;
    };
    self.values = (v: Row | Row[]) => {
      values = v;
      return self;
    };
    self.set = (v: Row) => {
      values = v;
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      if (op === "select") {
        queries.push({ table, where, params, locked });
        return Promise.resolve(selectRows(table, shape, where)).then(
          onFulfilled,
          onRejected,
        );
      }
      if (table === "workspace" && op === "insert" && s.workspaceInsertError) {
        return Promise.reject(s.workspaceInsertError).then(
          onFulfilled,
          onRejected,
        );
      }
      if (op === "insert" && table === s.failInsertOn) {
        return Promise.reject(new Error(`insert into ${table} failed`)).then(
          onFulfilled,
          onRejected,
        );
      }
      writes.push({ op, table, values });
      const row = Array.isArray(values) ? {} : values;
      return Promise.resolve([{ id: nextId(), ...row }]).then(
        onFulfilled,
        onRejected,
      );
    };
    return self;
  };

  const target = (op: "insert" | "update") => (t: unknown) => {
    const c = chain(op);
    (c.from as (t: unknown) => unknown)(t);
    return c;
  };

  const base = {
    execute: (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      executed.push(text);
      if (text.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: [
            {
              member_id: nextId(),
              member_role: s.role ?? "owner",
              member_status: "active",
            },
          ],
        });
      }
      if (text.includes("find_active_user_id_by_email")) {
        return Promise.resolve({ rows: [{ user_id: s.inviteeId ?? null }] });
      }
      return Promise.resolve({ rows: [] });
    },
    select: (shape?: Row) => chain("select", shape ?? {}),
    insert: target("insert"),
    update: target("update"),
  };
  const db = {
    ...base,
    // Writes buffered inside the transaction are discarded when it rejects,
    // like a real ROLLBACK.
    transaction: async (fn: (tx: typeof base) => Promise<unknown>) => {
      const committed = writes.length;
      try {
        return await fn(base);
      } catch (error) {
        writes.length = committed;
        throw error;
      }
    },
  };

  return { db, writes, queries, executed };
}

const createCaller = createCallerFactory(
  createTRPCRouter({ workspace: workspaceRouter, users: usersRouter }),
);

function callerFor(s: Scenario) {
  const { db, writes, queries, executed } = fakeDb(s);
  const userId = nextId();
  const caller = createCaller({
    user: { id: userId, email: "caller@example.com" },
    db: db as never,
    requestId: "req-workspace-membership",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-workspace-membership" }),
    workspaceId: WORKSPACE,
  });
  return { caller, writes, queries, executed, userId };
}

const written = (writes: Write[], table: string) =>
  writes.filter((w) => w.table === table);

// ── workspace.create (H3) ──────────────────────────────────────────

describe("workspace.create", () => {
  const owner: Scenario = { profileOrg: ORG, ownsWorkspaceInOrg: true };

  it("always creates a starter workspace, whatever plan is sent", async () => {
    const { caller, writes } = callerFor(owner);

    await caller.workspace.create({
      name: "Sucursal Valencia",
      plan: "enterprise",
    } as never);

    expect(written(writes, "workspace")[0]?.values).toMatchObject({
      name: "Sucursal Valencia",
      plan: "starter",
      organizationId: ORG,
      status: "active",
    });
    expect(written(writes, "workspace_quota")[0]?.values).toMatchObject({
      maxUsers: 1,
    });
    const modules = written(writes, "workspace_module")[0]?.values as Row[];
    expect(modules.map((m) => m.module)).toContain("pos");
    expect(modules.map((m) => m.module)).not.toContain("containers");
  });

  it("takes the organization from the caller's profile", async () => {
    const { caller, writes } = callerFor(owner);
    await caller.workspace.create({ name: "Sucursal Maracay" });
    expect(written(writes, "workspace")[0]?.values).toMatchObject({
      organizationId: ORG,
    });
  });

  it("accepts the caller's own organization when it is sent", async () => {
    const { caller, writes } = callerFor(owner);
    await caller.workspace.create({
      name: "Sucursal Barinas",
      organizationId: ORG,
    });
    expect(written(writes, "workspace")).toHaveLength(1);
  });

  it("rejects another company's organization without writing", async () => {
    const { caller, writes } = callerFor(owner);
    await expect(
      caller.workspace.create({ name: "Intrusa", organizationId: OTHER_ORG }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("rejects a caller without an organization", async () => {
    const { caller, writes } = callerFor({ profileOrg: null });
    await expect(
      caller.workspace.create({ name: "Sin Organización" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("rejects a member who owns no workspace in the organization", async () => {
    const { caller, writes } = callerFor({
      profileOrg: ORG,
      ownsWorkspaceInOrg: false,
    });
    await expect(
      caller.workspace.create({ name: "Empleado Creativo" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("requires an active owner membership of an active workspace", async () => {
    const { caller, queries, userId } = callerFor(owner);
    await caller.workspace.create({ name: "Sucursal Guárico" });

    const ownership = queries.find((q) =>
      q.where.includes(`"workspace"."organizationId"`),
    );
    // An ownership lookup that dropped the role or the status filters would
    // let any member of the organization create workspaces.
    expect(ownership?.params).toEqual([
      userId,
      "owner",
      "active",
      ORG,
      "active",
    ]);
  });

  it("writes nothing when a later step of the transaction fails", async () => {
    const { caller, writes } = callerFor({
      ...owner,
      failInsertOn: "workspace_quota",
    });
    await expect(
      caller.workspace.create({ name: "Rollback" }),
    ).rejects.toThrowError(Error);
    expect(writes).toEqual([]);
  });

  it("makes the creator owner and records the creation", async () => {
    const { caller, writes, userId } = callerFor(owner);
    await caller.workspace.create({ name: "Sucursal Mérida" });

    expect(written(writes, "workspace_member")[0]?.values).toMatchObject({
      userId,
      role: "owner",
      status: "active",
    });
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "workspace.create",
      entity: "workspace",
      actorId: userId,
    });
  });

  it("maps a concurrent slug collision to CONFLICT", async () => {
    const { caller } = callerFor({
      ...owner,
      workspaceInsertError: Object.assign(new Error("insert failed"), {
        cause: { code: "23505" },
      }),
    });
    await expect(
      caller.workspace.create({ name: "Duplicado" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );
  });
});

// ── workspace.inviteMember (M7) ────────────────────────────────────

describe("workspace.inviteMember", () => {
  const invite = { email: "Nuevo@Example.com", role: "employee" as const };

  it("creates a pending invitation, never an active member", async () => {
    const { caller, writes, userId } = callerFor({
      role: "owner",
      inviteeId: INVITEE,
      existingMember: null,
    });

    await expect(caller.workspace.inviteMember(invite)).resolves.toEqual({
      ok: true,
    });

    expect(written(writes, "workspace_member")).toEqual([
      {
        op: "insert",
        table: "workspace_member",
        values: expect.objectContaining({
          workspaceId: WORKSPACE,
          userId: INVITEE,
          role: "employee",
          status: "invited",
          invitedBy: userId,
        }) as Row,
      },
    ]);
  });

  it("looks the email up through the definer function, lower-cased", async () => {
    const { caller, executed } = callerFor({
      role: "owner",
      inviteeId: INVITEE,
    });
    await caller.workspace.inviteMember(invite);
    expect(
      executed.some((text) => text.includes("find_active_user_id_by_email")),
    ).toBe(true);
  });

  it.each([
    ["an unknown email", { inviteeId: null, existingMember: null }],
    [
      "an active member",
      {
        inviteeId: INVITEE,
        existingMember: { id: nextId(), status: "active" },
      },
    ],
    [
      "a pending invitation",
      {
        inviteeId: INVITEE,
        existingMember: { id: nextId(), status: "invited" },
      },
    ],
    [
      "a suspended member",
      {
        inviteeId: INVITEE,
        existingMember: { id: nextId(), status: "suspended" },
      },
    ],
  ])(
    "answers exactly the same for %s and writes no membership",
    async (_case, scenario) => {
      const { caller, writes } = callerFor({ role: "owner", ...scenario });
      await expect(caller.workspace.inviteMember(invite)).resolves.toEqual({
        ok: true,
      });
      expect(written(writes, "workspace_member")).toEqual([]);
    },
  );

  it("audits every attempt identically, without revealing the outcome", async () => {
    const found = callerFor({ role: "owner", inviteeId: INVITEE });
    const missing = callerFor({ role: "owner", inviteeId: null });
    await found.caller.workspace.inviteMember(invite);
    await missing.caller.workspace.inviteMember(invite);

    const audit = (w: Write[]) => {
      const values = written(w, "audit_log")[0]?.values as Row;
      return {
        action: values.action,
        entity: values.entity,
        entityId: values.entityId,
        newValue: values.newValue,
      };
    };
    expect(audit(found.writes)).toEqual(audit(missing.writes));
    expect(audit(found.writes)).toEqual({
      action: "workspace.invite_member",
      entity: "workspace_member",
      entityId: undefined,
      newValue: { email: "nuevo@example.com", role: "employee" },
    });
  });

  it("re-invites a removed member as pending", async () => {
    const { caller, writes, userId } = callerFor({
      role: "owner",
      inviteeId: INVITEE,
      existingMember: { id: nextId(), status: "removed" },
    });
    await caller.workspace.inviteMember(invite);
    expect(written(writes, "workspace_member")).toEqual([
      {
        op: "update",
        table: "workspace_member",
        values: expect.objectContaining({
          status: "invited",
          role: "employee",
          invitedBy: userId,
        }) as Row,
      },
    ]);
  });

  it("counts pending invitations against maxUsers before any lookup", async () => {
    const { caller, writes, executed, queries } = callerFor({
      role: "owner",
      maxUsers: 3,
      memberCount: 3,
      inviteeId: INVITEE,
    });
    await expect(caller.workspace.inviteMember(invite)).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(writes).toEqual([]);
    expect(
      executed.some((text) => text.includes("find_active_user_id_by_email")),
    ).toBe(false);
    expect(queries.find((q) => q.table === "workspace_quota")?.locked).toBe(
      true,
    );
    // Pending invitations must hold a seat, otherwise the quota can be
    // exceeded by inviting more people than seats and letting them accept.
    const counted = queries.find(
      (q) => q.table === "workspace_member" && q.where.includes("status"),
    );
    expect(counted?.params).toEqual([WORKSPACE, "active", "invited"]);
  });

  it("treats a negative maxUsers as unlimited", async () => {
    const { caller, writes } = callerFor({
      role: "owner",
      maxUsers: -1,
      memberCount: 500,
      inviteeId: INVITEE,
    });
    await caller.workspace.inviteMember(invite);
    expect(written(writes, "workspace_member")).toHaveLength(1);
  });

  it("keeps admin invitations owner-only", async () => {
    const { caller, writes } = callerFor({
      role: "admin",
      inviteeId: INVITEE,
    });
    await expect(
      caller.workspace.inviteMember({ ...invite, role: "admin" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    expect(writes).toEqual([]);
  });
});

// ── Member listings (enumeration) ──────────────────────────────────

describe("member listings hide pending invitations and removed members", () => {
  // Showing an `invited` row would reveal that the invited email belongs to
  // an account (undoing inviteMember's uniform answer) and expose the
  // profile of someone who never agreed to join; a `removed` row would keep
  // exposing a former member's current profile.
  it.each([
    ["workspace.members", "users.read"],
    ["users.list", "users.read"],
  ])("%s only returns active and suspended members", async (procedure) => {
    const { caller, queries } = callerFor({ role: "owner" });

    if (procedure === "workspace.members") {
      await caller.workspace.members();
    } else {
      await caller.users.list();
    }

    const listing = queries.find(
      (q) => q.table === "workspace_member" && q.where.includes("status"),
    );
    expect(listing?.params).toEqual([WORKSPACE, "active", "suspended"]);
  });
});

// ── Invitee side ───────────────────────────────────────────────────

describe("workspace.acceptInvite / declineInvite", () => {
  it("activates the caller's own pending invitation", async () => {
    const { caller, writes, queries, userId } = callerFor({
      existingMember: { id: nextId(), status: "invited", role: "employee" },
      maxUsers: 5,
      memberCount: 2,
    });

    await expect(
      caller.workspace.acceptInvite({ workspaceId: WORKSPACE }),
    ).resolves.toEqual({ ok: true });

    expect(written(writes, "workspace_member")[0]?.values).toMatchObject({
      status: "active",
    });
    const lookup = queries.find(
      (q) => q.table === "workspace_member" && q.where.includes("userId"),
    );
    expect(lookup?.where).toContain(`"workspace_member"."status" = $`);
    expect(written(writes, "audit_log")[0]?.values).toMatchObject({
      action: "workspace.accept_invite",
      workspaceId: WORKSPACE,
      actorId: userId,
    });
  });

  it("returns NOT_FOUND without a pending invitation", async () => {
    const { caller, writes } = callerFor({ existingMember: null });
    await expect(
      caller.workspace.acceptInvite({ workspaceId: WORKSPACE }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("re-checks the quota on acceptance, counting active members", async () => {
    const { caller, writes, queries } = callerFor({
      existingMember: { id: nextId(), status: "invited" },
      maxUsers: 2,
      memberCount: 2,
    });
    await expect(
      caller.workspace.acceptInvite({ workspaceId: WORKSPACE }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );
    expect(writes).toEqual([]);
    expect(queries.find((q) => q.table === "workspace_quota")?.locked).toBe(
      true,
    );
    const counted = queries.find(
      (q) =>
        q.table === "workspace_member" && q.where.includes("status" + '" in'),
    );
    expect(counted?.params).toEqual([WORKSPACE, "active"]);
  });

  it("refuses to join a workspace that is not active", async () => {
    const { caller, writes } = callerFor({
      existingMember: { id: nextId(), status: "invited" },
      workspaceStatus: "suspended",
    });
    await expect(
      caller.workspace.acceptInvite({ workspaceId: WORKSPACE }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(writes).toEqual([]);
  });

  it("declines by removing the pending membership", async () => {
    const { caller, writes } = callerFor({
      existingMember: { id: nextId(), status: "invited" },
    });
    await expect(
      caller.workspace.declineInvite({ workspaceId: WORKSPACE }),
    ).resolves.toEqual({ ok: true });
    expect(written(writes, "workspace_member")[0]?.values).toMatchObject({
      status: "removed",
    });
  });

  it("returns NOT_FOUND when declining without a pending invitation", async () => {
    const { caller, writes } = callerFor({ existingMember: null });
    await expect(
      caller.workspace.declineInvite({ workspaceId: WORKSPACE }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(writes).toEqual([]);
  });
});
