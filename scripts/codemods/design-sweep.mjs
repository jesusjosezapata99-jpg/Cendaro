#!/usr/bin/env node
/**
 * T1.12 — mechanical design sweep (PLAN-2026-09-MIDDAY-REDESIGN §F1).
 *
 * 1. `font-(semibold|bold|extrabold)` → `font-medium` (Hedvig Letters Sans
 *    only ships weight 400 — a heavier class would make Chrome synthesize a
 *    fake bold). Monetary-total call sites are NOT specially handled here —
 *    per the plan they get size/color hierarchy instead of weight, which
 *    needs per-call-site judgment; flagged for manual follow-up, not blind
 *    codemod'd.
 * 2. Stray `shadow-*` classes removed, except the primitives' own literal
 *    `shadow-md`/`shadow-2xl` uses already reviewed in T1.7 (this script only
 *    touches `apps/erp/src`, never `packages/ui/src`).
 * 3. `glass-(sidebar|topbar|overlay)` → `bg-background`/`bg-popover` (T1.5
 *    already deleted the source classes; the 3 remaining className
 *    references were fixed by hand in this same task, so this step is a
 *    no-op safety net if any survive).
 *
 * Usage: node scripts/codemods/design-sweep.mjs [--write]
 */
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TARGET = "apps/erp/src";

const FONT_WEIGHT_RE = /\bfont-(semibold|bold|extrabold)\b/g;
const GLASS_RE = /\bglass-sidebar\b|\bglass-topbar\b|\bglass-overlay\b/g;

function listFiles() {
  const out = execSync(
    `git -C "${REPO_ROOT}" grep -lE "font-(semibold|bold|extrabold)|glass-(sidebar|topbar|overlay)" -- "${TARGET}/*.tsx" "${TARGET}/**/*.tsx"`,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 },
  );
  return Array.from(
    new Set(
      out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ).map((l) => path.join(REPO_ROOT, l));
}

async function processFile(filePath) {
  const original = await readFile(filePath, "utf8");
  let fontCount = 0;
  let glassCount = 0;

  let next = original.replace(FONT_WEIGHT_RE, () => {
    fontCount++;
    return "font-medium";
  });
  next = next.replace(GLASS_RE, (m) => {
    glassCount++;
    return m === "glass-topbar" || m === "glass-overlay"
      ? "bg-popover"
      : "bg-background";
  });

  if (fontCount === 0 && glassCount === 0) return null;
  if (WRITE) await writeFile(filePath, next, "utf8");
  return { filePath, fontCount, glassCount };
}

async function main() {
  const files = listFiles();
  let totalFont = 0;
  let totalGlass = 0;
  let changed = 0;
  for (const file of files) {
    const result = await processFile(file);
    if (!result) continue;
    changed++;
    totalFont += result.fontCount;
    totalGlass += result.glassCount;
    console.log(
      `  font:${result.fontCount.toString().padStart(3)}  glass:${result.glassCount}  ${path.relative(REPO_ROOT, file)}`,
    );
  }
  console.log(
    `\n${totalFont} font-weight classes + ${totalGlass} glass-* classes ${WRITE ? "converted" : "would convert"} across ${changed} files.`,
  );
  if (!WRITE) console.log("Dry run — re-run with --write to apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
