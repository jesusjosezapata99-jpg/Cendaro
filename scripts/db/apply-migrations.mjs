#!/usr/bin/env node
/**
 * Builds a disposable Postgres from scratch: the production baseline
 * (packages/db/baseline/production-022.sql) plus the migrations after it, and
 * stops at the first error. Rollback files are ignored.
 *
 *   node scripts/db/apply-migrations.mjs --url <postgres-url>
 *   node scripts/db/apply-migrations.mjs --up-to 022
 *   node scripts/db/apply-migrations.mjs --order 024,025,026,027,028,029,023
 *
 * `--up-to 022` reproduces today's production. `--order` rehearses a
 * production order that differs from the numeric one.
 *
 * Refuses any host other than localhost: production only receives approved
 * migrations through the supabase-write protocol.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "packages/db/migrations");
const BOOTSTRAP = path.join(ROOT, "scripts/db/bootstrap-ci.sql");
const BASELINE = path.join(ROOT, "packages/db/baseline/production-022.sql");
const BASELINE_NUMBER = "022";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const { Client } = createRequire(path.join(ROOT, "packages/db/package.json"))(
  "pg",
);

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    "up-to": { type: "string" },
    order: { type: "string" },
  },
});

const url = args.url ?? process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Pass --url or set TEST_DATABASE_URL");
if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error(
    `Refusing to migrate non-local host ${new URL(url).hostname}`,
  );
}

const migrationNumber = (file) => file.slice(0, 3);
const allFiles = readdirSync(MIGRATIONS_DIR)
  .filter(
    (f) =>
      /^\d{3}_.*\.sql$/.test(f) &&
      !f.endsWith(".rollback.sql") &&
      migrationNumber(f) > BASELINE_NUMBER,
  )
  .sort();

function selectFiles() {
  if (args.order) {
    return args.order.split(",").map((n) => {
      const file = allFiles.find((f) => migrationNumber(f) === n.trim());
      if (!file) throw new Error(`No migration numbered ${n}`);
      return file;
    });
  }
  const limit = args["up-to"];
  return limit ? allFiles.filter((f) => migrationNumber(f) <= limit) : allFiles;
}

/**
 * A multi-statement query runs in one implicit transaction, which CREATE INDEX
 * CONCURRENTLY rejects, so those files run statement by statement.
 */
async function runMigration(client, sql) {
  if (!/\bCONCURRENTLY\b/i.test(sql)) {
    await client.query(sql);
    return;
  }
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await client.query(statement);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query(readFileSync(BOOTSTRAP, "utf8"));
  await client.query(readFileSync(BASELINE, "utf8"));
  process.stdout.write(`ok   baseline ${BASELINE_NUMBER}\n`);
  for (const file of selectFiles()) {
    try {
      await runMigration(
        client,
        readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"),
      );
      process.stdout.write(`ok   ${file}\n`);
    } catch (error) {
      process.stderr.write(`FAIL ${file}: ${error.message}\n`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
