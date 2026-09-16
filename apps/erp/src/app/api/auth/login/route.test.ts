import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PLAN-2026-09-PROD-HARDENING · F5 — the login route must fail closed when the
// service role key is missing instead of falling back to the anon key (which
// cannot read user_profile and would reject every user as "Credenciales
// incorrectas").

/** Mirrors the runtime reality: env validation is skipped under CI. */
interface SupabaseEnvMock {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const mocks = vi.hoisted(() => {
  const env: SupabaseEnvMock = {};
  return { env, createClient: vi.fn(), signInWithPassword: vi.fn() };
});

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => Promise.resolve({})) }));
vi.mock("@cendaro/auth/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const { POST } = await import("./route");

let requestCounter = 0;

/** Unique IP + username per request so the in-memory rate limiter never interferes. */
function loginRequest(): Request {
  requestCounter += 1;
  const body = JSON.stringify({
    username: `f5-user-${requestCounter}`,
    password: "not-a-real-password",
  });
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(body.length),
      "x-forwarded-for": `10.5.0.${requestCounter}`,
    },
    body,
  });
}

/** Admin client whose username lookup finds nothing. */
function adminClientWithoutProfile() {
  const single = vi.fn(() =>
    Promise.resolve({ data: null, error: { message: "no rows" } }),
  );
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) };
}

describe("POST /api/auth/login — service role key (F5)", () => {
  beforeEach(() => {
    mocks.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    mocks.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mocks.createClient.mockReset();
    mocks.signInWithPassword.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([undefined, ""])(
    "returns 500 (not 401) and never builds a Supabase client when the key is %j",
    async (missingKey) => {
      mocks.env.SUPABASE_SERVICE_ROLE_KEY = missingKey;

      const res = await POST(loginRequest());

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Configuración del servidor incompleta",
      });
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledOnce();
    },
  );

  it("builds the admin client with the service key, never the anon key", async () => {
    mocks.createClient.mockReturnValue(adminClientWithoutProfile());
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await POST(loginRequest());

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
    );
    // Unknown username still takes the constant-time path → generic 401.
    expect(mocks.signInWithPassword).toHaveBeenCalledOnce();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Credenciales incorrectas",
    });
  });
});
