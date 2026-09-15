import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const createDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  // Supabase connection modes:
  //   1. Session-mode pooler  (pooler.supabase.com:5432) → IPv4, supports prepared stmts
  //   2. Transaction-mode pooler (pooler.supabase.com:6543) → IPv4, NO prepared stmts
  //   3. Direct (db.xxx.supabase.co:5432) → IPv6 only, supports prepared stmts
  //
  // Production incident 2026-09-15 — two stacked failures:
  //
  //   a) The session pooler pins one backend per client for the client's
  //      whole lifetime, capped at the project's pool_size (15). Each Vercel
  //      function instance opens its own pool, so a handful of warm instances
  //      exhausted all 15 slots and every further query failed with
  //      EMAXCONNSESSION → HTTP 500 across the ERP. The transaction pooler
  //      multiplexes clients per transaction, so the pooler host is always
  //      used on 6543. Safe: all app session state is transaction-scoped
  //      (`SET LOCAL ROLE`, `set_config(..., true)` in workspaceProcedure).
  //
  //   b) postgres.js pipelines concurrent queries on one connection, and
  //      Supavisor in transaction mode can reassign the backend between
  //      pipelined queries, losing the response — the query hangs forever
  //      with no error (porsager/postgres#970, open upstream). Reproduced:
  //      157/300 reads hung at 60 clients; `max_pipeline: 0` fixes reads but
  //      breaks `sql.begin` (UNSAFE_TRANSACTION). node-postgres never
  //      pipelines (one in-flight query per client, the Pool queues the rest)
  //      and passed 900/900 reads + SET LOCAL transactions at 60 clients.
  //      It uses unnamed statements, so no prepared-statement config needed.
  //
  // Parse the connection URL safely to avoid incomplete substring matching
  // (CodeQL: js/incomplete-url-substring-sanitization)
  const connectionUrl = (() => {
    try {
      return new URL(connectionString);
    } catch {
      return null;
    }
  })();
  if (
    connectionUrl?.hostname.endsWith(".pooler.supabase.com") &&
    connectionUrl.port === "5432"
  ) {
    connectionUrl.port = "6543";
  }
  const isTransactionPooler = connectionUrl?.port === "6543";
  const isSupabase =
    connectionUrl?.hostname.endsWith(".supabase.co") === true ||
    connectionUrl?.hostname.endsWith(".supabase.com") === true;

  const pool = new Pool({
    connectionString: connectionUrl?.toString() ?? connectionString,

    // Connection pool sizing (per server instance):
    //   Transaction pooler: Supavisor shares 15 backends across all clients,
    //   so a small per-instance pool is enough to run a tRPC batch in
    //   parallel without hoarding client slots.
    //   Direct/local: conservative to avoid exhausting connection limits
    max: isTransactionPooler ? 5 : 3,

    // Release idle connections quickly — serverless instances sit idle
    // between bursts and should not hold pooler slots while doing so.
    idleTimeoutMillis: 20_000,

    // Fail fast instead of leaving the UI on skeletons for 30s: a healthy
    // pooler connects in ~200ms, and React Query retries transient failures.
    connectionTimeoutMillis: 10_000,

    // Recycle connections every 5 minutes on Supabase to prevent stale conns
    // being killed by Supavisor's connection supervisor
    maxLifetimeSeconds: isSupabase ? 300 : 0,

    // Application name for connection tracing in pg_stat_activity
    application_name: "cendaro",
  });

  // An idle client that errors (pooler restart, network blip) is emitted on
  // the pool; without a listener Node treats it as unhandled and crashes the
  // function. pg already evicts the broken client — the next query simply
  // checks out a fresh one — so there is nothing else to do here.
  pool.on("error", () => undefined);

  return drizzle(pool, { schema, casing: "snake_case" });
};

/**
 * Lazily initialized database client.
 *
 * Uses a module-scoped singleton so the connection is only created on first
 * access at runtime, not at import / build time. This allows Next.js to
 * import packages that reference `db` during the build step without
 * requiring a live DATABASE_URL.
 */
let _db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  return (_db ??= createDb());
}

/**
 * Reset the database connection pool.
 * Use when connection errors persist (e.g. after Supabase maintenance).
 */
export function resetDb() {
  const previous = _db;
  _db = undefined;
  void previous?.$client.end().catch(() => undefined);
}

/**
 * Pre-establish a database connection so the first user request is fast.
 * Call this once during server startup (e.g. in Next.js instrumentation.ts).
 * Runs `SELECT 1` to force the pool to open a TCP+TLS connection ahead of time.
 */
export async function warmPool() {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  } catch {
    // Non-fatal — pool will connect on first real query
  }
}
