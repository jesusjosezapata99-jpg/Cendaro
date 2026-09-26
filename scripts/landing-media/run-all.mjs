#!/usr/bin/env node
/**
 * One command for the whole media pipeline (PLAN-2026-09-LANDING-REDESIGN F3):
 * record → encode → publish + manifest.
 *
 * Prerequisites: the demo workspace is seeded (seed-demo-workspace.mjs) and
 * the app is running against it (`pnpm with-env next start -p 3120` in
 * apps/erp). Extra arguments (--clip, --theme, --base) go to record.mjs.
 *
 * Usage (repo root): node scripts/landing-media/run-all.mjs [--clip id]
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const extra = process.argv.slice(2);
const clipArgs = extra.includes("--clip")
  ? ["--clip", extra[extra.indexOf("--clip") + 1]]
  : [];

const steps = [
  ["record", "record.mjs", extra],
  ["encode", "encode.mjs", clipArgs],
  ["publish", "build-manifest.mjs", []],
];

for (const [name, script, args] of steps) {
  const started = Date.now();
  console.log(`\n▶ ${name}`);
  const { status } = spawnSync(
    process.execPath,
    [join(HERE, script), ...args],
    { stdio: "inherit" },
  );
  if (status !== 0) {
    console.error(`✗ ${name} failed (exit ${status})`);
    process.exit(status ?? 1);
  }
  console.log(`✓ ${name} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
