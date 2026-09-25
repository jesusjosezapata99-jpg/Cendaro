/**
 * Minimal node-postgres helpers for the landing-media scripts. Uses the same
 * driver (`pg`) and DATABASE_URL as @cendaro/db. Table and column names come
 * from these scripts, never from input; values are always parameters.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { Client } = createRequire(join(ROOT, "packages/db/package.json"))("pg");

/** Postgres limit is 65 535 bind parameters per statement. */
const MAX_PARAMS = 60_000;

export const ident = (name) => `"${String(name).replaceAll('"', '""')}"`;

export async function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing");
  const client = new Client({
    connectionString,
    application_name: "cendaro-landing-media",
  });
  await client.connect();
  return client;
}

/** Runs `fn` in BEGIN/COMMIT; any error rolls back and is rethrown. */
export async function transaction(client, fn) {
  await client.query("BEGIN");
  try {
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/** Runs one statement inside a savepoint so a failure keeps the transaction usable. */
export async function inSavepoint(client, text, values = []) {
  await client.query("SAVEPOINT landing_media");
  try {
    const result = await client.query(text, values);
    await client.query("RELEASE SAVEPOINT landing_media");
    return result;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT landing_media");
    throw error;
  }
}

/** Multi-row INSERT of plain objects (missing keys become NULL). */
export async function insert(client, table, rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) return;
  const cols = [...new Set(list.flatMap((row) => Object.keys(row)))];
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  for (let start = 0; start < list.length; start += perStatement) {
    const chunk = list.slice(start, start + perStatement);
    const values = [];
    const tuples = chunk.map(
      (row) =>
        `(${cols
          .map((col) => {
            values.push(row[col] ?? null);
            return `$${values.length}`;
          })
          .join(", ")})`,
    );
    await client.query(
      `insert into ${ident(table)} (${cols.map(ident).join(", ")}) values ${tuples.join(", ")}`,
      values,
    );
  }
}
