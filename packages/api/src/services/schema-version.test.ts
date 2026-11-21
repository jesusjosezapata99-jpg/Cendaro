import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import { checkSchemaVersion, EXPECTED_MIGRATION } from "./schema-version";

const MIGRATIONS = path.resolve(__dirname, "../../../db/migrations");

const dbReturning = (rows: unknown[]) => ({
  execute: vi.fn().mockResolvedValue({ rows }),
});

describe("checkSchemaVersion", () => {
  it("expects the newest migration in the repository", () => {
    const newest = readdirSync(MIGRATIONS)
      .filter(
        (name) => /^\d+_.*\.sql$/.test(name) && !name.includes("rollback"),
      )
      .sort()
      .at(-1);

    expect(newest?.replace(/^\d+_|\.sql$/g, "")).toBe(EXPECTED_MIGRATION);
  });

  it("stays quiet when the migration is applied", async () => {
    const error = vi.spyOn(logger, "error");

    const status = await checkSchemaVersion(
      dbReturning([{ "?column?": 1 }]) as never,
    );

    expect(status).toEqual({ expected: EXPECTED_MIGRATION, applied: true });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("logs an error when production is behind", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    const status = await checkSchemaVersion(dbReturning([]) as never);

    expect(status.applied).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "production is missing the expected migration",
      expect.objectContaining({ expected: EXPECTED_MIGRATION }),
    );
    error.mockRestore();
  });

  it("counts a failed check as not applied instead of throwing", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const db = { execute: vi.fn().mockRejectedValue(new Error("no access")) };

    const status = await checkSchemaVersion(db as never);

    expect(status.applied).toBe(false);
    error.mockRestore();
  });
});
