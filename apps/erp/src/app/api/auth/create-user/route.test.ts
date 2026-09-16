import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PLAN-2026-09-PROD-HARDENING · F5 — create-user must fail closed when the
// service role key is missing, and must only reveal that to owner/admin.

/** Mirrors the runtime reality: env validation is skipped under CI. */
interface CreateUserMockState {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  callerRole?: string;
  createClient: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => {
  const state: CreateUserMockState = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    },
    createClient: vi.fn(),
  };
  return state;
});

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => Promise.resolve({})) }));
vi.mock("@cendaro/auth/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: "caller-id",
              user_metadata: { role: mocks.callerRole },
            },
          },
        }),
      ),
    },
  })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const { POST } = await import("./route");

let requestCounter = 0;

/** Unique IP per request so the in-memory rate limiter (3/60s) never interferes. */
function createUserRequest(): Request {
  requestCounter += 1;
  return new Request("http://localhost/api/auth/create-user", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.6.0.${requestCounter}`,
    },
    body: JSON.stringify({
      username: `f5-new-${requestCounter}`,
      fullName: "F5 Test",
      email: `f5-new-${requestCounter}@example.com`,
      password: "not-a-real-password",
      role: "vendor",
    }),
  });
}

/** Admin client whose duplicate-username check finds a row → 409, no writes. */
function adminClientWithExistingUsername() {
  const single = vi.fn(() =>
    Promise.resolve({ data: { id: "existing" }, error: null }),
  );
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) };
}

describe("POST /api/auth/create-user — service role key (F5)", () => {
  beforeEach(() => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mocks.callerRole = "owner";
    mocks.createClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 and never builds an admin client when the key is missing", async () => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = undefined;

    const res = await POST(createUserRequest());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Configuración del servidor incompleta",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("does not reveal the configuration error to a non-admin caller", async () => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    mocks.callerRole = "vendor";

    const res = await POST(createUserRequest());

    expect(res.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("builds the admin client with the service key", async () => {
    mocks.createClient.mockReturnValue(adminClientWithExistingUsername());

    const res = await POST(createUserRequest());

    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
    );
    expect(res.status).toBe(409);
  });
});
