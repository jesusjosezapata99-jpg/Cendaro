#!/usr/bin/env node
/**
 * Generates packages/ui/src/icons.tsx (PLAN-2026-09-MIDDAY-REDESIGN T1.6).
 *
 * Two icon sources, matching what Midday itself renders:
 *   - `md` (icons.manifest.json): react-icons/md components — Midday uses
 *     these directly for its UI glyphs (search, close, chevrons, ...), so we
 *     import the exact same components instead of approximating them.
 *   - `symbols`: everything else (nav/domain icons). Midday's own custom-SVG
 *     icons are, byte-for-byte, Material Symbols Outlined at weight 300 /
 *     optical size 24 (verified 2026-09, see plan §5.6) — Material Symbols
 *     is Apache-2.0, so fetching the path data from Google's own CDN is a
 *     clean-room match, not a copy of Midday's code.
 *
 * Run: pnpm -F @cendaro/ui icons
 * Output is committed (no network fetch at build/runtime — CSP stays intact).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SUBSET_PATH = path.join(
  REPO_ROOT,
  "apps/erp/src/app/fonts/material-symbols-subset.txt",
);
const MANIFEST_PATH = path.join(__dirname, "icons.manifest.json");
const OUTPUT_PATH = path.join(__dirname, "../src/icons.tsx");

const SVG_ENDPOINT = (symbol) =>
  `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${symbol}/wght300/24px.svg`;

function toPascalCase(snakeCase) {
  return snakeCase
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

async function fetchPath(symbol) {
  const url = SVG_ENDPOINT(symbol);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${symbol}: HTTP ${res.status} (${url})`);
  }
  const svg = await res.text();
  const viewBoxMatch = /viewBox="([^"]+)"/.exec(svg);
  const dMatch = /<path d="([^"]+)"/.exec(svg);
  if (!viewBoxMatch || !dMatch) {
    throw new Error(`Could not parse SVG for ${symbol}: ${svg.slice(0, 200)}`);
  }
  if (viewBoxMatch[1] !== "0 -960 960 960") {
    throw new Error(
      `Unexpected viewBox for ${symbol}: ${viewBoxMatch[1]} (expected "0 -960 960 960")`,
    );
  }
  return dMatch[1];
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const subsetText = await readFile(SUBSET_PATH, "utf8");
  const subsetSymbols = subsetText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const allSymbolNames = Array.from(
    new Set([...subsetSymbols, ...manifest.extraSymbols]),
  ).sort();

  const mdEntries = Object.entries(manifest.md); // [PascalName, MdComponentName][]
  const mdPascalNames = new Set(mdEntries.map(([pascal]) => pascal));

  // MD wins on collision — Midday itself renders these via react-icons/md.
  const symbolEntries = allSymbolNames
    .map((snake) => [toPascalCase(snake), snake])
    .filter(([pascal]) => !mdPascalNames.has(pascal));

  // De-dupe PascalNames that different snake_case inputs might collide on
  // (none expected, but fail loudly rather than silently overwrite).
  const seen = new Map();
  for (const [pascal, snake] of symbolEntries) {
    if (seen.has(pascal)) {
      throw new Error(
        `Duplicate PascalName "${pascal}" from "${snake}" and "${seen.get(pascal)}"`,
      );
    }
    seen.set(pascal, snake);
  }

  console.log(
    `Fetching ${symbolEntries.length} Material Symbols (wght300/24px)...`,
  );
  const paths = {};
  let done = 0;
  for (const [pascal, snake] of symbolEntries) {
    paths[pascal] = await fetchPath(snake);
    done++;
    if (done % 20 === 0 || done === symbolEntries.length) {
      console.log(`  ${done}/${symbolEntries.length}`);
    }
  }

  const mdImportNames = mdEntries.map(([, mdName]) => mdName).sort();
  const mdImportLine = `import { ${mdImportNames.join(", ")} } from "react-icons/md";`;

  const symbolIconEntries = Object.entries(paths)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([pascal, d]) =>
        `  ${pascal}: (props: SymbolIconProps) => (\n    <SymbolIcon {...props}>\n      <path d="${d}" />\n    </SymbolIcon>\n  ),`,
    )
    .join("\n");

  const mdIconEntries = mdEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pascal, mdName]) => `  ${pascal}: ${mdName},`)
    .join("\n");

  const output = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Run \`pnpm -F @cendaro/ui icons\` (packages/ui/scripts/generate-icons.mjs)
 * to regenerate. See PLAN-2026-09-MIDDAY-REDESIGN §5.6 / T1.6.
 *
 * ${mdImportNames.length} icons from react-icons/md (Midday's own UI glyphs)
 * + ${symbolIconEntries ? Object.keys(paths).length : 0} from Material Symbols
 * Outlined wght300/opsz24 (Midday's custom-SVG nav/domain icons — verified
 * pixel-identical, Apache-2.0, fetched from Google Fonts' own CDN).
 */
import type { IconType } from "react-icons";
${mdImportLine}

interface SymbolIconProps {
  size?: number;
  className?: string;
  title?: string;
}

/** wght300/opsz24 Material Symbols Outlined, rendered at 20px by default
 * (matches Midday's SVGIcon wrapper exactly). */
function SymbolIcon({
  size = 20,
  className,
  title,
  children,
}: SymbolIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Icons = {
${mdIconEntries}
${symbolIconEntries}
} as const satisfies Record<string, IconType | ((props: SymbolIconProps) => React.ReactElement)>;

export type IconName = keyof typeof Icons;

/** Renders any icon by its dynamic name (config-driven icon fields, ternaries,
 * lookup maps) without the caller having to index \`Icons\` manually. */
export function Icon({
  name,
  className,
  size,
  title,
}: { name: IconName } & SymbolIconProps) {
  const Component = Icons[name];
  return <Component className={className} size={size} title={title} />;
}
`;

  await writeFile(OUTPUT_PATH, output, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(
    `${mdImportNames.length} md icons + ${Object.keys(paths).length} symbol icons = ${
      mdImportNames.length + Object.keys(paths).length
    } total.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
