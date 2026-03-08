/**
 * Next.js Instrumentation — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Used to pre-warm the database connection pool so the first user request
 * doesn't pay the ~200ms TCP+TLS handshake penalty.
 */
export async function register() {
  // Only warm the pool on the server (not during build or on the edge)
  // eslint-disable-next-line no-restricted-properties -- NEXT_RUNTIME is only available via process.env, not in ~/env
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmPool } = await import("@cendaro/db/client");
    await warmPool();
  }
}
