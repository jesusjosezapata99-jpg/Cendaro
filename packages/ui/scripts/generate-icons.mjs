#!/usr/bin/env node
/**
 * Generates packages/ui/src/icons.tsx (PLAN-2026-09-DESIGN-SYSTEM T1.6).
 *
 * Two icon sources:
 *   - `md` (icons.manifest.json): react-icons/md components — standard UI
 *     glyphs (search, close, chevrons, ...).
 *   - `symbols`: everything else (nav/domain icons). Material Symbols
 *     Outlined at weight 300 / optical size 24 (Apache-2.0, fetched from Google CDN).
 *
 * Run: pnpm -F @cendaro/ui icons
 * Output is committed (no network fetch at build/runtime — CSP stays intact).
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import manifest from "./icons.manifest.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/icons.tsx");

const SVG_ENDPOINT = (symbol) =>
  `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${symbol}/wght300/24px.svg`;

const SAFE_SYMBOL_PATTERN = /^[a-z0-9_]+$/;

const SUBSET_SYMBOLS = [
  "account_balance",
  "account_balance_wallet",
  "add",
  "add_circle",
  "alternate_email",
  "analytics",
  "arrow_back",
  "arrow_forward",
  "assignment",
  "attach_money",
  "auto_stories",
  "badge",
  "balance",
  "barcode_scanner",
  "block",
  "bolt",
  "branding_watermark",
  "business",
  "calendar_today",
  "category",
  "chat",
  "check",
  "check_circle",
  "chevron_right",
  "close",
  "cloud_upload",
  "construction",
  "contactless",
  "credit_card",
  "credit_card_off",
  "currency_bitcoin",
  "currency_exchange",
  "currency_yuan",
  "dark_mode",
  "dashboard",
  "database",
  "delete",
  "deployed_code",
  "description",
  "directions_boat",
  "download",
  "draft",
  "edit",
  "error",
  "error_outline",
  "expand_more",
  "fact_check",
  "factory",
  "flag",
  "flight_land",
  "flight_takeoff",
  "folder_off",
  "group",
  "help",
  "history",
  "hourglass_top",
  "image",
  "inbox",
  "info",
  "inventory",
  "inventory_2",
  "label_off",
  "light_mode",
  "lightbulb",
  "list",
  "list_alt",
  "local_shipping",
  "location_on",
  "lock",
  "lock_clock",
  "lock_open",
  "logout",
  "mail",
  "manage_accounts",
  "manage_search",
  "menu",
  "money",
  "move_to_inbox",
  "notifications",
  "notifications_active",
  "notifications_off",
  "open_in_new",
  "package_2",
  "paid",
  "payment",
  "payments",
  "pending",
  "person",
  "person_add",
  "person_off",
  "phone",
  "photo_camera",
  "playlist_add",
  "point_of_sale",
  "policy",
  "preview",
  "price_change",
  "priority_high",
  "progress_activity",
  "qr_code",
  "receipt",
  "receipt_long",
  "refresh",
  "request_quote",
  "restart_alt",
  "restore",
  "schedule",
  "search",
  "search_off",
  "sell",
  "settings",
  "shield",
  "shopping_cart",
  "shopping_cart_off",
  "skip_next",
  "smart_toy",
  "smartphone",
  "stacks",
  "store",
  "storefront",
  "swap_horiz",
  "sync",
  "sync_alt",
  "task_alt",
  "trending_down",
  "trending_up",
  "tune",
  "update",
  "upload",
  "upload_file",
  "verified",
  "visibility",
  "visibility_off",
  "warehouse",
  "warning",
  "web",
];

function toPascalCase(snakeCase) {
  return snakeCase
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

async function fetchPath(rawSymbol) {
  if (typeof rawSymbol !== "string" || !SAFE_SYMBOL_PATTERN.test(rawSymbol)) {
    throw new Error(`Invalid symbol identifier: "${rawSymbol}"`);
  }
  const symbol = encodeURIComponent(rawSymbol);
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
  const allSymbolNames = Array.from(
    new Set([...SUBSET_SYMBOLS, ...manifest.extraSymbols]),
  ).sort();

  const mdEntries = Object.entries(manifest.md); // [PascalName, MdComponentName][]
  const mdPascalNames = new Set(mdEntries.map(([pascal]) => pascal));

  // MD wins on collision — rendered via react-icons/md.
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
 * to regenerate. See PLAN-2026-09-DESIGN-SYSTEM §5.6 / T1.6.
 *
 * ${mdImportNames.length} icons from react-icons/md (standard UI glyphs)
 * + ${symbolIconEntries ? Object.keys(paths).length : 0} from Material Symbols
 * Outlined wght300/opsz24 (custom-SVG nav/domain icons — verified
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
 * (matches SVGIcon wrapper). */
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
