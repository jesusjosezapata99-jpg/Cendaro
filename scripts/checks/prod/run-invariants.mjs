#!/usr/bin/env node
/**
 * Runs financial-invariants.sql and fails if any invariant has violations. It only
 * reads, and prints counts: never customer data.
 *
 *   PRODUCTION_MONITOR_URL=<connection string> node scripts/checks/prod/run-invariants.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Client } = createRequire(
  path.join(here, "../../../packages/db/package.json"),
)("pg");

const connectionString = process.env.PRODUCTION_MONITOR_URL;
if (!connectionString) {
  console.error("Missing PRODUCTION_MONITOR_URL");
  process.exit(2);
}

const client = new Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(
    readFileSync(path.join(here, "financial-invariants.sql"), "utf8"),
  );
  const broken = rows.filter((row) => Number(row.violations) > 0);
  for (const row of rows) {
    console.log(`${String(row.violations).padStart(6)}  ${row.invariant}`);
  }
  if (broken.length > 0) {
    console.error(`${broken.length} invariant(s) broken`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
