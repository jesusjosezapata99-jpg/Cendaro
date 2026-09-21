import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/ai/parse-packing-list
 *
 * PLAN-2026-09-SECURITY-REMEDIATION F8.1/F8.2 — this endpoint used to accept
 * any authenticated user with no workspace/permission check (a plausible
 * x-workspace-id was optional and silently defaulted to "any workspace this
 * user belongs to"), and forwarded client-supplied imageUrls straight to
 * Groq's server-to-server image fetcher with no origin check. These tests
 * cover only the guards this phase changed — the full parse pipeline (Groq
 * calls, file parsing) is not exercised here; see F8.3's known gap note in
 * the plan's execution log for why the zip-bomb caps are not covered by an
 * automated test in this session.
 */

const WORKSPACE = "b0000000-0000-0000-0000-000000000001";
const CALLER_ID = "a0000000-0000-0000-0000-0000000000c1";

const mocks = vi.hoisted(() => ({
  env: {
    GROQ_API_KEY: "groq-test-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
  claims: null as Record<string, unknown> | null,
  memberRole: null as string | null,
}));

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: () => undefined })),
}));
vi.mock("@cendaro/auth/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getClaims: vi.fn(() =>
        Promise.resolve({
          data: mocks.claims ? { claims: mocks.claims } : null,
        }),
      ),
    },
  })),
}));

// apps/erp must not depend on drizzle-orm directly. Stringify the drizzle
// SQL object from its chunks instead of reaching for PgDialect, which lives
// in @cendaro/db's dependency tree, not this package's.
interface DrizzleSql {
  queryChunks?: { value?: unknown }[];
}
const sqlText = (query: DrizzleSql): string =>
  (query.queryChunks ?? [])
    .map((chunk) =>
      typeof chunk.value === "string"
        ? chunk.value
        : Array.isArray(chunk.value)
          ? chunk.value.join("")
          : "",
    )
    .join("");

vi.mock("@cendaro/db/client", () => ({
  getDb: () => ({
    execute: (query: DrizzleSql) => {
      const text = sqlText(query);
      if (text.includes("is_workspace_member")) {
        return Promise.resolve({
          rows: mocks.memberRole ? [{ member_role: mocks.memberRole }] : [],
        });
      }
      return Promise.resolve({ rows: [] });
    },
  }),
}));

const { POST } = await import("./route");

function jsonRequest(opts: {
  workspace?: string | null;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.workspace !== undefined && opts.workspace !== null
      ? { "x-workspace-id": opts.workspace }
      : {}),
    ...opts.headers,
  };
  return new Request("https://erp.example.com/api/ai/parse-packing-list", {
    method: "POST",
    headers,
    body: JSON.stringify(
      opts.body ?? {
        rows: [["item"]],
        containerId: "c0000000-0000-0000-0000-000000000001",
      },
    ),
  });
}

describe("POST /api/ai/parse-packing-list", () => {
  beforeEach(() => {
    mocks.claims = { sub: CALLER_ID, email: "actor@example.com" };
    mocks.memberRole = "owner";
  });

  it("rejects an unauthenticated caller with 401", async () => {
    mocks.claims = null;
    const res = await POST(jsonRequest({ workspace: WORKSPACE }) as never);
    expect(res.status).toBe(401);
  });

  it("rejects a request with no x-workspace-id header with 400", async () => {
    const res = await POST(jsonRequest({ workspace: null }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects a non-UUID x-workspace-id with 400", async () => {
    const res = await POST(jsonRequest({ workspace: "not-a-uuid" }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects a caller who is not an active member of the workspace with 403", async () => {
    mocks.memberRole = null;
    const res = await POST(jsonRequest({ workspace: WORKSPACE }) as never);
    expect(res.status).toBe(403);
  });

  it("rejects a member whose role lacks containers.update with 403", async () => {
    mocks.memberRole = "vendor";
    const res = await POST(jsonRequest({ workspace: WORKSPACE }) as never);
    expect(res.status).toBe(403);
  });

  it("rejects a request whose declared Content-Length exceeds the payload cap with 413", async () => {
    const res = await POST(
      jsonRequest({
        workspace: WORKSPACE,
        headers: { "content-length": String(11 * 1024 * 1024) },
      }) as never,
    );
    expect(res.status).toBe(413);
  });

  it("rejects a rows array beyond the Zod cap with 400", async () => {
    const tooManyRows = Array.from({ length: 5001 }, () => ["x"]);
    const res = await POST(
      jsonRequest({
        workspace: WORKSPACE,
        body: {
          rows: tooManyRows,
          containerId: "c0000000-0000-0000-0000-000000000001",
        },
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("rejects an imageUrl that does not belong to this project's storage / workspace with 400", async () => {
    const res = await POST(
      jsonRequest({
        workspace: WORKSPACE,
        body: {
          rows: [["item"]],
          containerId: "c0000000-0000-0000-0000-000000000001",
          imageUrls: ["https://evil.example.com/exfiltrate"],
        },
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("fails closed with 500 when GROQ_API_KEY is not configured", async () => {
    mocks.env.GROQ_API_KEY = "";
    const res = await POST(jsonRequest({ workspace: WORKSPACE }) as never);
    expect(res.status).toBe(500);
    mocks.env.GROQ_API_KEY = "groq-test-key";
  });
});
