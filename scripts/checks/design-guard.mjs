#!/usr/bin/env node
/**
 * T1.13 — design guard (PLAN-2026-09-MIDDAY-REDESIGN §F1).
 *
 * Counts forbidden design-debt patterns in `apps/erp/src` and
 * `packages/ui/src` and fails (exit 1) once a pattern exceeds its
 * per-phase threshold. Phases only ever tighten (never loosen) as the
 * redesign progresses — F1 requires zero Material Symbols / glass-* /
 * font-bold leftovers; F7 requires zero of everything.
 *
 * Usage: node scripts/checks/design-guard.mjs --phase F1
 */
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCAN_DIRS = ["apps/erp/src", "packages/ui/src"];

const phaseArg = process.argv.find((a) => a.startsWith("--phase"));
const PHASE =
  phaseArg === "--phase"
    ? process.argv[process.argv.indexOf("--phase") + 1]
    : phaseArg?.split("=")[1];

if (!PHASE || !/^F[0-9]$/.test(PHASE)) {
  console.error('Usage: design-guard.mjs --phase F1..F9 (e.g. "--phase F1")');
  process.exit(1);
}
const phaseNum = Number(PHASE.slice(1));

// Tailwind shadow classes explicitly allowed by §5.5 (dialog/sheet/dropdown
// overlays, and the two literal shadow-2xl/shadow-lg spots still pending
// cleanup until F7's final pass).
const SHADOW_WHITELIST = new Set(["shadow-xs", "shadow-md"]);

const PATTERNS = [
  {
    name: "material-symbols",
    re: /material-symbols/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 1,
  },
  {
    name: "glass-",
    re: /\bglass-(sidebar|topbar|overlay)\b/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 1,
  },
  {
    name: "surface-card",
    re: /\bsurface-card\b/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 7,
  },
  {
    name: "font-bold",
    re: /\bfont-(semibold|bold|extrabold)\b/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 1,
  },
  {
    name: "shadow-",
    re: /\bshadow-(xs|sm|md|lg|xl|2xl)\b|(?<![\w-])shadow(?![\w-])/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 7,
    // Only count occurrences NOT in the whitelist.
    filterMatch: (m) => !SHADOW_WHITELIST.has(m),
  },
  {
    name: "hex-literal",
    re: /#[0-9a-fA-F]{3,8}\b/g,
    dirs: ["apps/erp/src"],
    zeroFromPhase: 7,
  },
  {
    name: "rounded-",
    re: /\brounded-(sm|md|lg|xl|2xl|3xl)\b/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 7,
  },
  {
    name: "STATUS_CONFIG",
    re: /\bSTATUS_CONFIG\b/g,
    dirs: SCAN_DIRS,
    zeroFromPhase: 7,
  },
];

function listFiles(dir) {
  try {
    const out = execSync(
      `git -C "${REPO_ROOT}" ls-files -- "${dir}/*.ts" "${dir}/*.tsx" "${dir}/*.css"`,
      { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 },
    );
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => path.join(REPO_ROOT, l));
  } catch {
    return [];
  }
}

async function countPattern(pattern) {
  const files = pattern.dirs.flatMap(listFiles);
  let count = 0;
  const hits = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const matches = content.match(pattern.re) ?? [];
    const filtered = pattern.filterMatch
      ? matches.filter(pattern.filterMatch)
      : matches;
    if (filtered.length > 0) {
      count += filtered.length;
      hits.push({ file: path.relative(REPO_ROOT, file), count: filtered.length });
    }
  }
  return { count, hits };
}

async function main() {
  console.log(`design-guard --phase ${PHASE}\n`);
  let failed = false;
  const rows = [];

  for (const pattern of PATTERNS) {
    const threshold = phaseNum >= pattern.zeroFromPhase ? 0 : Infinity;
    const { count, hits } = await countPattern(pattern);
    const ok = count <= threshold;
    if (!ok) failed = true;
    rows.push({ name: pattern.name, count, threshold, ok, hits });
  }

  const nameWidth = Math.max(...rows.map((r) => r.name.length));
  for (const row of rows) {
    const status = row.ok ? "PASS" : "FAIL";
    const thresholdLabel = row.threshold === Infinity ? "n/a" : row.threshold;
    console.log(
      `  ${row.ok ? "✓" : "✗"} ${row.name.padEnd(nameWidth)}  count=${row.count.toString().padStart(4)}  threshold=${thresholdLabel}  [${status}]`,
    );
    if (!row.ok) {
      for (const hit of row.hits.slice(0, 10)) {
        console.log(`      ${hit.count.toString().padStart(3)}  ${hit.file}`);
      }
      if (row.hits.length > 10) {
        console.log(`      ... and ${row.hits.length - 10} more files`);
      }
    }
  }

  console.log(
    failed
      ? "\ndesign-guard FAILED — see patterns above."
      : "\ndesign-guard PASSED.",
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
