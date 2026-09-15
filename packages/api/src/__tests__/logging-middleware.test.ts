/**
 * Cendaro — API Unit Tests: Logging Middleware (C2 regression)
 *
 * Verifies that `loggingMiddleware` in `../trpc` actually logs failed
 * procedures. tRPC's `next()` never rejects — every middleware level
 * catches the downstream error and resolves `next()` with
 * `{ ok: false, error }` (see @trpc/server's `callRecursive`). A
 * `try/catch` around `await next()` therefore never fires; the middleware
 * must branch on `result.ok` instead. This test pins that behavior so a
 * future refactor can't silently reintroduce the dead-code catch.
 */
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../logger";
import {
  createCallerFactory,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";

// `logger.child(...)` returns a new instance sharing the same prototype,
// so spying on the prototype methods captures calls made through any
// request-scoped child logger (as `loggingMiddleware` uses).
const loggerProto = Object.getPrototypeOf(logger) as {
  warn: typeof logger.warn;
  error: typeof logger.error;
  debug: typeof logger.debug;
  info: typeof logger.info;
};

function buildCaller() {
  const testRouter = createTRPCRouter({
    ok: publicProcedure.query(() => "fine"),
    forbidden: publicProcedure.query(() => {
      throw new TRPCError({ code: "FORBIDDEN", message: "nope" });
    }),
    boom: publicProcedure.query(() => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "boom",
      });
    }),
  });

  const ctx = {
    user: null,
    db: {} as never, // unused — none of the test procedures touch ctx.db
    requestId: "test-req",
    log: logger.child({ requestId: "test-req" }),
    workspaceId: null,
  };

  const createCaller = createCallerFactory(testRouter);
  return createCaller(ctx);
}

describe("loggingMiddleware (C2 regression)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a client TRPCError (FORBIDDEN) at warn, not silently", async () => {
    const warnSpy = vi.spyOn(loggerProto, "warn");
    const errorSpy = vi.spyOn(loggerProto, "error");
    const caller = buildCaller();

    await expect(caller.forbidden()).rejects.toThrow(TRPCError);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("✗"),
      expect.objectContaining({ trpcCode: "FORBIDDEN" }),
      expect.any(TRPCError),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs an unexpected TRPCError (INTERNAL_SERVER_ERROR) at error level", async () => {
    const errorSpy = vi.spyOn(loggerProto, "error");
    const caller = buildCaller();

    await expect(caller.boom()).rejects.toThrow(TRPCError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("✗"),
      expect.objectContaining({ trpcCode: "INTERNAL_SERVER_ERROR" }),
      expect.any(TRPCError),
    );
  });

  it("does not log a warn/error for a successful call", async () => {
    const warnSpy = vi.spyOn(loggerProto, "warn");
    const errorSpy = vi.spyOn(loggerProto, "error");
    const caller = buildCaller();

    await expect(caller.ok()).resolves.toBe("fine");

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
