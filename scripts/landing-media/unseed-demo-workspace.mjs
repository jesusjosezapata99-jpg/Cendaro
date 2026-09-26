#!/usr/bin/env node
/**
 * Removes the landing demo company created by seed-demo-workspace.mjs
 * (PLAN-2026-09-LANDING-REDESIGN T3.1), including anything the recordings
 * added to it (audit log, sessions, new orders…).
 *
 * Scope is strictly the workspace with slug "distribuidora-aurora-demo" and
 * the user "demo.aurora": every public table with a workspace_id column is
 * cleared for that workspace only, in passes until foreign keys allow it,
 * inside one transaction. Then the auth user is deleted via the Admin API.
 *
 * Usage (repo root):
 *   node scripts/landing-media/unseed-demo-workspace.mjs --dry-run
 *   node scripts/landing-media/unseed-demo-workspace.mjs
 */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { connect, ident, inSavepoint, transaction } from "./db.mjs";
import { DEMO } from "./demo-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DRY_RUN = process.argv.includes("--dry-run");
const MAX_PASSES = 12;

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // Variables may already be in the environment.
}

const db = await connect();

const {
  rows: [workspace],
} = await db.query(
  "select id, organization_id from workspace where slug = $1",
  [DEMO.workspace.slug],
);
const {
  rows: [profile],
} = await db.query("select id from user_profile where username = $1", [
  DEMO.owner.username,
]);

if (!workspace && !profile) {
  console.log("Nothing to remove: the demo workspace and user do not exist.");
  await db.end();
  process.exit(0);
}

// Safety: the demo user must belong to no other workspace.
if (profile) {
  const { rows: others } = await db.query(
    `select workspace_id from workspace_member
     where user_id = $1 and workspace_id is distinct from $2`,
    [profile.id, workspace?.id ?? null],
  );
  if (others.length > 0) {
    console.error("Refusing: the demo user is a member of another workspace.");
    await db.end();
    process.exit(1);
  }
}

const tables = (
  await db.query(
    `select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'workspace_id'
       and table_name <> 'workspace'`,
  )
).rows.map((r) => r.table_name);

console.log(
  `Demo workspace: ${workspace?.id ?? "(none)"} · user: ${profile?.id ?? "(none)"}`,
);
if (workspace) {
  for (const table of tables) {
    const {
      rows: [{ count }],
    } = await db.query(
      `select count(*)::int as count from ${ident(table)} where workspace_id = $1`,
      [workspace.id],
    );
    if (count > 0) console.log(`  ${table}: ${count}`);
  }
}
if (DRY_RUN) {
  console.log("[dry-run] Nothing deleted.");
  await db.end();
  process.exit(0);
}

await transaction(db, async () => {
  if (workspace) {
    let pending = [...tables];
    for (let pass = 0; pass < MAX_PASSES && pending.length > 0; pass++) {
      const blocked = [];
      for (const table of pending) {
        try {
          await inSavepoint(
            db,
            `delete from ${ident(table)} where workspace_id = $1`,
            [workspace.id],
          );
        } catch (error) {
          if (error.code !== "23503") throw error; // only FK order is retried
          blocked.push(table);
        }
      }
      pending = blocked;
    }
    if (pending.length > 0) {
      throw new Error(`Could not clear (foreign keys): ${pending.join(", ")}`);
    }
  }
  // workspace.created_by points at the profile and the profile points back at
  // the workspace and organization: release the profile's links first, drop
  // the workspace and organization, and only then the profile itself.
  if (profile) {
    await db.query(
      "update user_profile set default_workspace_id = null, organization_id = null where id = $1",
      [profile.id],
    );
  }
  if (workspace) {
    await db.query("delete from workspace where id = $1", [workspace.id]);
    await db.query(
      `delete from organization o where o.id = $1
         and not exists (select 1 from workspace w where w.organization_id = o.id)`,
      [workspace.organization_id],
    );
  }
  if (profile) {
    // Session bookkeeping of the demo user; tolerated if the shape differs.
    await inSavepoint(
      db,
      "delete from user_session_activity where user_id = $1",
      [profile.id],
    ).catch(() => undefined);
    await db.query("delete from user_profile where id = $1", [profile.id]);
  }
});

if (profile) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/auth/v1/admin/users/${profile.id}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`Auth user not deleted: ${res.status} ${await res.text()}`);
  }
}

rmSync(join(ROOT, ".env.landing-demo"), { force: true });
await db.end();
console.log("Demo workspace, user and local credentials removed.");
