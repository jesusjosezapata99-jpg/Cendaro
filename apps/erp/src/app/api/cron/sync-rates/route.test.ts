import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/cron/sync-rates — daily Vercel Cron job
 * (internal plan F4.1).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. The route fails closed:
 * without a configured secret nothing runs, and any other header is 401.
 */

const mocks = vi.hoisted(() => {
  const env: { CRON_SECRET?: string } = {};
  return {
    env,
    runScheduledRateSync: vi.fn(),
    checkSchemaVersion: vi.fn(),
    captureMessage: vi.fn(),
    loggerError: vi.fn(),
  };
});

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("@cendaro/api", () => ({
  runScheduledRateSync: mocks.runScheduledRateSync,
  checkSchemaVersion: mocks.checkSchemaVersion,
  logger: { error: mocks.loggerError },
}));
vi.mock("@cendaro/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));

const { GET } = await import("./route");

const SECRET = "s".repeat(40);
const CURRENT_SCHEMA = { expected: "monitor_role", applied: true };

function request(authorization?: string): Request {
  return new Request("https://erp.example.com/api/cron/sync-rates", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/sync-rates", () => {
  beforeEach(() => {
    mocks.env.CRON_SECRET = SECRET;
    mocks.runScheduledRateSync.mockReset();
    mocks.runScheduledRateSync.mockResolvedValue({
      upstream: { ves: true, cny: true },
      workspaces: [],
    });
    mocks.checkSchemaVersion.mockReset();
    mocks.checkSchemaVersion.mockResolvedValue(CURRENT_SCHEMA);
    mocks.captureMessage.mockReset();
    mocks.loggerError.mockReset();
  });

  it("refuses to run without a configured secret", async () => {
    delete mocks.env.CRON_SECRET;

    const res = await GET(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(503);
    expect(mocks.runScheduledRateSync).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("refuses to run with a secret that is too short", async () => {
    mocks.env.CRON_SECRET = "short-secret";

    const res = await GET(request("Bearer short-secret"));

    expect(res.status).toBe(503);
    expect(mocks.runScheduledRateSync).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect((await GET(request(SECRET))).status).toBe(401);
    expect(mocks.runScheduledRateSync).not.toHaveBeenCalled();
  });

  it("runs the sync for the scheduler", async () => {
    const res = await GET(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      upstream: { ves: true, cny: true },
      workspaces: [],
      schema: CURRENT_SCHEMA,
    });
    expect(mocks.runScheduledRateSync).toHaveBeenCalledTimes(1);
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it("reports to Sentry when production is missing a migration", async () => {
    mocks.checkSchemaVersion.mockResolvedValue({
      expected: "monitor_role",
      applied: false,
    });

    const res = await GET(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Production is missing migration monitor_role",
      "error",
    );
  });

  it("reports a failed run as a server error", async () => {
    mocks.runScheduledRateSync.mockRejectedValue(new Error("db down"));

    const res = await GET(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
