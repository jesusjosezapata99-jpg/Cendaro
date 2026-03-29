import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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
  // We use session-mode pooler for IPv4 compatibility + RLS bypass via postgres role.
  // Parse the connection URL safely to avoid incomplete substring matching
  // (CodeQL: js/incomplete-url-substring-sanitization)
  const connectionUrl = (() => {
    try {
      return new URL(connectionString);
    } catch {
      return null;
    }
  })();
  const isTransactionPooler = connectionUrl?.port === "6543";
  const isSupabase =
    connectionUrl?.hostname.endsWith(".supabase.co") === true ||
    connectionUrl?.hostname.endsWith(".supabase.com") === true;

  const client = postgres(connectionString, {
    // Connection pool sizing:
    //   Pooler: higher limit since Supavisor manages backend connections
    //   Direct/local: conservative to avoid exhausting connection limits
    max: isTransactionPooler ? 20 : 5,

    // Idle connection cleanup — free connections back after 20s of inactivity
    idle_timeout: 20,

    // Connection timeout — Supabase free-tier hibernates after inactivity.
    // Cold starts can take 15-25s, so we allow 30s for the initial connection.
    connect_timeout: 30,

    // Transaction-mode poolers don't persist session state → no prepared stmts.
    // Session-mode pooler (5432) and direct connections support prepared stmts.
    prepare: !isTransactionPooler,

    // Recycle connections every 5 minutes on Supabase to prevent stale conns
    // being killed by Supavisor's connection supervisor
    max_lifetime: isSupabase ? 300 : undefined,

    // Application name for connection tracing in pg_stat_activity
    connection: { application_name: "cendaro" },
  });

  return drizzle(client, { schema, casing: "snake_case" });
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
  _db = undefined;
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
