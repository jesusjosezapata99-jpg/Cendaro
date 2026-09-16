/**
 * Next.js Instrumentation — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 1. Initialises Sentry for the runtime that is starting.
 * 2. Pre-warms the database connection pool so the first user request
 *    doesn't pay the ~200ms TCP+TLS handshake penalty.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  // eslint-disable-next-line no-restricted-properties -- NEXT_RUNTIME is only available via process.env, not in ~/env
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { warmPool } = await import("@cendaro/db/client");
    await warmPool();
  }

  // eslint-disable-next-line no-restricted-properties -- NEXT_RUNTIME is only available via process.env, not in ~/env
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Errors thrown by Server Components, route handlers and the proxy.
export const onRequestError = Sentry.captureRequestError;
