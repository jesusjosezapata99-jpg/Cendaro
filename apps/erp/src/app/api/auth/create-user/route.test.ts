import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/auth/create-user
 *
 * PLAN-2026-09-PROD-HARDENING F5 — fail closed without the service role key.
 * PLAN-2026-09-SECURITY-REMEDIATION F1 (C1) — authorization comes only from
 * `workspace_member`; a forged `user_metadata.role` has no effect.
 */

interface Result {
  data?: unknown;
  error?: { message: string } | null;
  count?: number;
}
type Op = [string, ...unknown[]];
type Resolver = (table: string, ops: Op[]) => Result;

interface MockState {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  caller: { id: string; user_metadata?: Record<string, unknown> } | null;
  cookieWorkspace?: string;
  createClient: ReturnType<typeof vi.fn>;
  loggerError: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => {
  const state: MockState = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    },
    caller: null,
    createClient: vi.fn(),
    loggerError: vi.fn(),
  };
  return state;
});

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name: string) =>
        name === "cendaro-workspace-id" && mocks.cookieWorkspace
          ? { value: mocks.cookieWorkspace }
          : undefined,
    }),
  ),
}));
vi.mock("@cendaro/auth/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: mocks.caller } })),
    },
  })),
}));
vi.mock("@cendaro/api", () => ({
  buildAuditIntegrityMetadata: () => ({ _hashAlgorithm: "sha256" }),
  isValidUuid: (v: unknown) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  logger: { error: mocks.loggerError },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const { POST } = await import("./route");

const WORKSPACE = "b0000000-0000-0000-0000-000000000001";
const CALLER_ID = "a0000000-0000-0000-0000-0000000000c1";
const NEW_USER_ID = "a0000000-0000-0000-0000-0000000000e1";

/** Chainable, thenable Supabase query builder stand-in that records every call. */
function fakeAdmin(
  resolve: Resolver,
  opts: { createUserError?: string; deleteUserError?: string } = {},
) {
  const calls: { table: string; ops: Op[] }[] = [];
  const auth = {
    admin: {
      createUser: vi.fn((_args: { user_metadata: Record<string, unknown> }) =>
        Promise.resolve(
          opts.createUserError
            ? { data: { user: null }, error: { message: opts.createUserError } }
            : { data: { user: { id: NEW_USER_ID } }, error: null },
        ),
      ),
      deleteUser: vi.fn((_id: string) =>
        Promise.resolve({
          error: opts.deleteUserError
            ? { message: opts.deleteUserError }
            : null,
        }),
      ),
    },
  };
  function from(table: string) {
    const ops: Op[] = [];
    calls.push({ table, ops });
    const builder: Record<string, unknown> = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") {
            return (
              ok: (r: Result) => unknown,
              fail: (e: unknown) => unknown,
            ) => Promise.resolve(resolve(table, ops)).then(ok, fail);
          }
          return (...args: unknown[]) => {
            ops.push([prop, ...args]);
            return builder;
          };
        },
      },
    );
    return builder;
  }
  return { client: { auth, from: vi.fn(from) }, calls, auth };
}

function has(ops: Op[], name: string, ...args: unknown[]) {
  return ops.some(
    ([op, ...rest]) =>
      op === name && args.every((arg, i) => Object.is(rest[i], arg)),
  );
}

interface Scenario {
  callerRole?: string | null;
  callerStatus?: string;
  maxUsers?: number;
  activeMembers?: number;
  usernameTaken?: boolean;
  memberInsertError?: string;
  profileUpsertError?: string;
  quotaError?: string;
  auditError?: string;
  memberDeleteError?: string;
}

const err = (message?: string) => (message ? { message } : null);

function scenario(s: Scenario = {}): Resolver {
  return (table, ops) => {
    if (table === "workspace_member") {
      if (has(ops, "insert")) return { error: err(s.memberInsertError) };
      if (has(ops, "delete")) return { error: err(s.memberDeleteError) };
      if (has(ops, "eq", "user_id", CALLER_ID)) {
        return {
          data:
            s.callerRole === null ? null : { role: s.callerRole ?? "owner" },
          error: null,
        };
      }
      return { count: s.activeMembers ?? 1, error: null };
    }
    if (table === "user_profile") {
      if (has(ops, "eq", "id", CALLER_ID)) {
        return {
          data: { full_name: "Dueño Real", status: s.callerStatus ?? "active" },
          error: null,
        };
      }
      if (has(ops, "eq", "username")) {
        return { data: s.usernameTaken ? { id: "existing" } : null };
      }
      if (has(ops, "upsert")) return { error: err(s.profileUpsertError) };
      return { error: null };
    }
    if (table === "workspace_quota") {
      return s.quotaError
        ? { data: null, error: err(s.quotaError) }
        : { data: { max_users: s.maxUsers ?? -1 }, error: null };
    }
    if (table === "audit_log") return { error: err(s.auditError) };
    return { data: null, error: null };
  };
}

let requestCounter = 0;

function createUserRequest(
  opts: {
    role?: string;
    origin?: string | null;
    workspace?: string | null;
  } = {},
): Request {
  requestCounter += 1;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": `10.6.0.${requestCounter}`,
  };
  if (opts.origin !== null) {
    headers.origin = opts.origin ?? "https://erp.example.com";
  }
  if (opts.workspace !== null) {
    headers["x-workspace-id"] = opts.workspace ?? WORKSPACE;
  }
  return new Request("https://erp.example.com/api/auth/create-user", {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: `f1-new-${requestCounter}`,
      fullName: "F1 Test",
      email: `f1-new-${requestCounter}@example.com`,
      password: "a-long-enough-password",
      role: opts.role ?? "employee",
    }),
  });
}

describe("POST /api/auth/create-user", () => {
  beforeEach(() => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mocks.caller = { id: CALLER_ID };
    mocks.cookieWorkspace = undefined;
    mocks.createClient.mockReset();
    mocks.loggerError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fail closed (F5)", () => {
    it("returns a generic 503 and never builds an admin client when the key is missing", async () => {
      mocks.env.SUPABASE_SERVICE_ROLE_KEY = undefined;

      const res = await POST(createUserRequest());

      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual({
        error: "Servicio no disponible temporalmente",
      });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.loggerError).toHaveBeenCalledOnce();
    });

    it("builds the admin client with the service key", async () => {
      const admin = fakeAdmin(scenario({ usernameTaken: true }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(mocks.createClient).toHaveBeenCalledWith(
        "https://example.supabase.co",
        "service-key",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      expect(res.status).toBe(409);
    });
  });

  describe("request guards", () => {
    it("rejects unauthenticated callers with 401", async () => {
      mocks.caller = null;
      const res = await POST(createUserRequest());
      expect(res.status).toBe(401);
    });

    it("rejects a cross-site Origin with 403 before building an admin client", async () => {
      const res = await POST(
        createUserRequest({ origin: "https://evil.example" }),
      );
      expect(res.status).toBe(403);
      expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("requires a valid workspace id", async () => {
      const res = await POST(createUserRequest({ workspace: "not-a-uuid" }));
      expect(res.status).toBe(400);
      expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("falls back to the workspace cookie when the header is absent", async () => {
      mocks.cookieWorkspace = WORKSPACE;
      const admin = fakeAdmin(scenario({ usernameTaken: true }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest({ workspace: null }));

      expect(res.status).toBe(409);
    });
  });

  describe("authorization from workspace_member (C1)", () => {
    it("ignores a forged user_metadata.role when the caller is not a member", async () => {
      mocks.caller = { id: CALLER_ID, user_metadata: { role: "owner" } };
      const admin = fakeAdmin(scenario({ callerRole: null }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(403);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it("ignores a forged owner role when the DB role is employee", async () => {
      mocks.caller = { id: CALLER_ID, user_metadata: { role: "owner" } };
      const admin = fakeAdmin(scenario({ callerRole: "employee" }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(403);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it("rejects an inactive profile even with an owner membership", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", callerStatus: "inactive" }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(403);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it.each(["owner", "admin"])(
      "forbids an admin from creating a %s",
      async (role) => {
        const admin = fakeAdmin(scenario({ callerRole: "admin" }));
        mocks.createClient.mockReturnValue(admin.client);

        const res = await POST(createUserRequest({ role }));

        expect(res.status).toBe(403);
        expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
      },
    );
  });

  describe("quota", () => {
    it("rejects creation when the plan user limit is reached", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", maxUsers: 1, activeMembers: 1 }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(409);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it("fails closed with 503 when the quota cannot be read", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", quotaError: "timeout" }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(503);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
      expect(mocks.loggerError).toHaveBeenCalledOnce();
    });
  });

  describe("workspace selection", () => {
    it("uses the x-workspace-id header over the cookie", async () => {
      mocks.cookieWorkspace = "c0000000-0000-0000-0000-000000000009";
      const admin = fakeAdmin(scenario({ usernameTaken: true }));
      mocks.createClient.mockReturnValue(admin.client);

      await POST(createUserRequest());

      const membershipLookup = admin.calls.find(
        (c) =>
          c.table === "workspace_member" &&
          has(c.ops, "eq", "user_id", CALLER_ID),
      );
      expect(
        has(membershipLookup?.ops ?? [], "eq", "workspace_id", WORKSPACE),
      ).toBe(true);
    });
  });

  describe("successful creation", () => {
    it("lets an owner create an admin", async () => {
      const admin = fakeAdmin(scenario({ callerRole: "owner" }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest({ role: "admin" }));

      expect(res.status).toBe(200);
    });

    it("still returns 200 and logs when only the audit insert fails", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", auditError: "audit down" }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(200);
      expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
      expect(mocks.loggerError).toHaveBeenCalledOnce();
    });

    it("maps an already registered email to 409 without rollback", async () => {
      const admin = fakeAdmin(scenario({ callerRole: "owner" }), {
        createUserError: "A user with this email has already been registered",
      });
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(409);
      expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it("creates the auth user, upserts the profile, adds the membership and audits", async () => {
      const admin = fakeAdmin(scenario({ callerRole: "admin" }));
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest({ role: "employee" }));

      expect(res.status).toBe(200);

      const createArgs = admin.auth.admin.createUser.mock.calls[0]?.[0];
      expect(createArgs?.user_metadata).toBeDefined();
      expect(createArgs?.user_metadata).not.toHaveProperty("role");

      const profileWrite = admin.calls.find(
        (c) => c.table === "user_profile" && has(c.ops, "upsert"),
      );
      expect(profileWrite?.ops[0]).toEqual([
        "upsert",
        expect.objectContaining({ id: NEW_USER_ID, role: "employee" }),
        { onConflict: "id" },
      ]);

      const memberInsert = admin.calls.find(
        (c) => c.table === "workspace_member" && has(c.ops, "insert"),
      );
      expect(memberInsert?.ops[0]).toEqual([
        "insert",
        {
          workspace_id: WORKSPACE,
          user_id: NEW_USER_ID,
          role: "employee",
          status: "active",
          invited_by: CALLER_ID,
        },
      ]);

      const audit = admin.calls.find((c) => c.table === "audit_log");
      expect(audit?.ops[0]).toEqual([
        "insert",
        expect.objectContaining({
          workspace_id: WORKSPACE,
          actor_id: CALLER_ID,
          actor_role: "admin",
          actor_name: "Dueño Real",
          action: "user.create",
        }),
      ]);
    });

    it("rolls back membership, profile and auth user when the membership insert fails", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", memberInsertError: "boom" }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(500);
      expect(
        admin.calls.some(
          (c) =>
            c.table === "workspace_member" &&
            has(c.ops, "delete") &&
            has(c.ops, "eq", "user_id", NEW_USER_ID),
        ),
      ).toBe(true);
      expect(
        admin.calls.some(
          (c) =>
            c.table === "user_profile" &&
            has(c.ops, "delete") &&
            has(c.ops, "eq", "id", NEW_USER_ID),
        ),
      ).toBe(true);
      expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(NEW_USER_ID);
    });

    it("rolls back without creating a membership when the profile upsert fails", async () => {
      const admin = fakeAdmin(
        scenario({ callerRole: "owner", profileUpsertError: "boom" }),
      );
      mocks.createClient.mockReturnValue(admin.client);

      const res = await POST(createUserRequest());

      expect(res.status).toBe(500);
      expect(
        admin.calls.some(
          (c) => c.table === "workspace_member" && has(c.ops, "insert"),
        ),
      ).toBe(false);
      expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(NEW_USER_ID);
    });

    it("still deletes the auth user and logs each failed rollback step", async () => {
      const admin = fakeAdmin(
        scenario({
          callerRole: "owner",
          memberInsertError: "boom",
          memberDeleteError: "cleanup failed",
        }),
        { deleteUserError: "auth delete failed" },
      );
      mocks.createClient.mockReturnValue(admin.client);

      await POST(createUserRequest());

      expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(NEW_USER_ID);
      const steps = mocks.loggerError.mock.calls
        .filter(([message]) => message === "[create-user] rollback step failed")
        .map(([, context]) => (context as { step: string }).step);
      expect(steps).toEqual(["workspace_member", "auth_user"]);
    });
  });
});
