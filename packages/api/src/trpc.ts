/**
 * Cendaro — tRPC Context & Procedures
 *
 * Defines the tRPC context (DB + user), public/protected procedures,
 * and RBAC-aware procedure helpers.
 */
import type { User } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { userRoleEnum } from "@cendaro/db/schema";
import { getDb } from "@cendaro/db/client";

import { logger, generateRequestId } from "./logger";
import type { ILogger } from "./logger";

// ──────────────────────────────────────────────
// 1. CONTEXT
// ──────────────────────────────────────────────

export interface UserMeta {
  role: (typeof userRoleEnum.enumValues)[number];
}

export const createTRPCContext = (opts: {
  headers: Headers;
  user: (User & { user_metadata?: UserMeta }) | null;
}): {
  user: (User & { user_metadata?: UserMeta }) | null;
  db: ReturnType<typeof getDb>;
  requestId: string;
  log: ILogger;
} => {
  const requestId = opts.headers.get("x-request-id") ?? generateRequestId();

  // Create a request-scoped logger with user context
  const userRole = (opts.user?.user_metadata as UserMeta | undefined)?.role;
  const log: ILogger = logger.child({
    requestId,
    userId: opts.user?.id,
    userRole,
  });

  return {
    user: opts.user,
    db: getDb(),
    requestId,
    log,
  };
};

// ──────────────────────────────────────────────
// 2. INITIALIZATION
// ──────────────────────────────────────────────

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

// ──────────────────────────────────────────────
// 3. ROUTER & PROCEDURES
// ──────────────────────────────────────────────

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Structured request logging middleware.
 *
 * • Logs every procedure call with requestId, path, userId, duration
 * • In dev: pretty colored output (all requests)
 * • In prod: structured JSON (only slow > 500ms + errors)
 * • Automatically tags slow queries (> 200ms warning, > 1000ms error)
 */
const loggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();
  const reqLog = ctx.log.child({ path, method: type });

  reqLog.debug(`→ ${path}`);

  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);

    if (durationMs > 1000) {
      reqLog.warn(`⚠ SLOW ${path}`, { durationMs });
    } else if (durationMs > 200) {
      reqLog.info(`✓ ${path}`, { durationMs });
    } else {
      reqLog.debug(`✓ ${path}`, { durationMs });
    }

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);

    if (err instanceof TRPCError) {
      // Expected errors (UNAUTHORIZED, FORBIDDEN, etc.) at warn level
      const isClientError = ["UNAUTHORIZED", "FORBIDDEN", "BAD_REQUEST", "NOT_FOUND"].includes(err.code);
      if (isClientError) {
        reqLog.warn(`✗ ${path} [${err.code}]`, { durationMs, trpcCode: err.code }, err);
      } else {
        reqLog.error(`✗ ${path} [${err.code}]`, { durationMs, trpcCode: err.code }, err);
      }
    } else {
      reqLog.error(`✗ ${path} [INTERNAL]`, { durationMs }, err);
    }

    throw err;
  }
});

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

/**
 * Protected (authenticated) procedure — requires valid session
 */
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        user: ctx.user,
      },
    });
  });

/**
 * Role-restricted procedure factory — requires specific roles
 * Usage: roleRestrictedProcedure(["admin", "owner"]).query(...)
 */
export function roleRestrictedProcedure(
  allowedRoles: (typeof userRoleEnum.enumValues)[number][],
) {
  return protectedProcedure.use(({ ctx, next }) => {
    const userRole = (ctx.user.user_metadata as UserMeta | undefined)?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Se requiere uno de los roles: ${allowedRoles.join(", ")}`,
      });
    }
    return next({ ctx });
  });
}

