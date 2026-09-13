#!/usr/bin/env node
/**
 * T2.9 — PLAN-2026-09-MIDDAY-REDESIGN.
 *
 * The new AppShell `<main>` now supplies horizontal padding itself
 * (`px-4 md:px-8`, §5.8.1 "Contenido"). Every `(app)` page still wraps its
 * own root div in `p-4 lg:p-8` (or `lg:p-6` for POS) — left as-is, every
 * route would get horizontal padding twice.
 *
 * This only touches lines that contain BOTH a bare `p-4` token AND an
 * `lg:p-(6|8)` token together — verified (via `rg`) to be exactly the
 * per-page root wrapper divs; every other `p-4` in these files (card/list
 * item padding) never appears together with an `lg:p-*` sibling on the
 * same line, so it is left untouched.
 *
 * Usage: node scripts/codemods/strip-page-horizontal-padding.mjs [--write]
 */
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const WRITE = process.argv.includes("--write");

const LINE_RE = /\bp-4\b/;
const LG_RE = /\blg:p-(6|8)\b/;
// Distinguishes the page's own root wrapper (always animate-in'd, or a bare
// loading/error `p-4 lg:p-X` div) from an interior card that coincidentally
// also uses `p-4 ... lg:p-X` (e.g. containers/[id]'s "Upload Zone" section,
// `space-y-4 p-4 lg:p-6` — never touched, its padding must stay).
const ROOT_WRAPPER_RE = /\banimate-in\b|\bspace-y-6\b/;
const BARE_RE = /className="p-4 lg:p-(6|8)"/;

function listFiles() {
  const out = execSync(
    `git -C "${REPO_ROOT}" ls-files -- "apps/erp/src/app/(app)/*.tsx" "apps/erp/src/app/(app)/**/*.tsx"`,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 },
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => path.join(REPO_ROOT, l));
}

async function processFile(file) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  let changed = 0;

  const nextLines = lines.map((line) => {
    if (!LINE_RE.test(line) || !LG_RE.test(line)) return line;
    if (!ROOT_WRAPPER_RE.test(line) && !BARE_RE.test(line)) return line;
    changed++;
    return line
      .replace(/\bp-4\b/, "py-4")
      .replace(/\blg:p-(6|8)\b/, (_m, n) => `lg:py-${n}`);
  });

  if (changed > 0) {
    console.log(`  ${changed.toString().padStart(2)}  ${path.relative(REPO_ROOT, file)}`);
    if (WRITE) {
      await writeFile(file, nextLines.join("\n"));
    }
  }
  return changed;
}

async function main() {
  console.log(`strip-page-horizontal-padding${WRITE ? " --write" : " (dry run)"}\n`);
  const files = listFiles();
  let total = 0;
  for (const file of files) {
    total += await processFile(file);
  }
  console.log(`\n${total} line(s) ${WRITE ? "changed" : "would change"} across ${files.length} files scanned.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
