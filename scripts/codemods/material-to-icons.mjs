#!/usr/bin/env node
/**
 * Codemod (PLAN-2026-09-MIDDAY-REDESIGN T1.6, step 4): rewrites
 *   <span className="material-symbols-outlined SOME_CLASSES">name</span>
 * to
 *   <Icons.Pascal className="SOME_CLASSES'" />
 * mapping any Tailwind text-size class present to the size-* scale the new
 * SVG icons use. Only handles STATIC ligature names (bare identifier as the
 * element's only content) — dynamic `{expr}` content is left untouched and
 * reported at the end for manual conversion to `Icons[name as IconName]`.
 *
 * Usage: node scripts/codemods/material-to-icons.mjs [--write]
 * Without --write, runs in dry-run mode and only reports counts.
 */
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TARGET_GLOB = "apps/erp/src";

const SIZE_MAP = {
  "text-xs": "size-3",
  "text-sm": "size-3.5",
  "text-base": "size-4",
  "text-lg": "size-[18px]",
  "text-xl": "size-5",
  "text-2xl": "size-6",
  "text-3xl": "size-[30px]",
  "text-4xl": "size-9",
};

function toPascalCase(snakeCase) {
  return snakeCase
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function remapClassName(rawClassName) {
  const tokens = rawClassName.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const token of tokens) {
    if (token === "material-symbols-outlined") continue;
    if (SIZE_MAP[token]) {
      kept.push(SIZE_MAP[token]);
      continue;
    }
    kept.push(token);
  }
  return kept.join(" ");
}

// Matches: <span (attrs before)className="...material-symbols-outlined...">CONTENT</span>
// CONTENT must be a bare snake_case/alnum identifier (static) — dynamic `{expr}`
// content never matches this pattern and is left alone.
const SPAN_RE =
  /<span((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s+className="([^"]*\bmaterial-symbols-outlined\b[^"]*)"((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*>\s*([a-zA-Z0-9_]+)\s*<\/span>/g;

async function processFile(filePath) {
  const original = await readFile(filePath, "utf8");
  let matchCount = 0;

  const transformed = original.replace(
    SPAN_RE,
    (full, preAttrs, className, postAttrs, ligature) => {
      matchCount++;
      const pascal = toPascalCase(ligature);
      const newClassName = remapClassName(className);
      const extraAttrs = `${preAttrs}${postAttrs}`.trim();
      const classAttr = newClassName ? ` className="${newClassName}"` : "";
      const extra = extraAttrs ? ` ${extraAttrs}` : "";
      return `<Icons.${pascal}${classAttr}${extra} />`;
    },
  );

  if (matchCount === 0) return { filePath, matchCount: 0, changed: false };

  let finalContent = transformed;
  if (WRITE) {
    // Ensure the Icons import exists.
    if (!/from "@cendaro\/ui\/icons"/.test(finalContent)) {
      const importLine = 'import { Icons } from "@cendaro/ui/icons";\n';
      // Insert after the last top-level import statement (simple heuristic:
      // after the last line starting with `import `).
      const lines = finalContent.split("\n");
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^import\s/.test(lines[i])) lastImportIdx = i;
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine.trimEnd());
        finalContent = lines.join("\n");
      } else {
        finalContent = importLine + finalContent;
      }
    }
    await writeFile(filePath, finalContent, "utf8");
  }

  return { filePath, matchCount, changed: true };
}

function listFiles() {
  const out = execSync(
    `git -C "${REPO_ROOT}" grep -l "material-symbols-outlined" -- "${TARGET_GLOB}/*.tsx"`,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 },
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => path.join(REPO_ROOT, l));
}

async function main() {
  const files = listFiles();
  console.log(`Scanning ${files.length} files (write=${WRITE})...`);
  let totalMatches = 0;
  let filesChanged = 0;
  for (const file of files) {
    const result = await processFile(file);
    if (result.changed) {
      totalMatches += result.matchCount;
      filesChanged++;
      console.log(
        `  ${result.matchCount.toString().padStart(3)}  ${path.relative(REPO_ROOT, file)}`,
      );
    }
  }
  console.log(
    `\n${totalMatches} static occurrences ${WRITE ? "converted" : "would convert"} across ${filesChanged} files.`,
  );
  if (!WRITE) {
    console.log("Dry run — re-run with --write to apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
