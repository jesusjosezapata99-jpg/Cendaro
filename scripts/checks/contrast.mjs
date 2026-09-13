#!/usr/bin/env node
/**
 * WCAG 2.x contrast checker for the Midday-derived theme
 * (PLAN-2026-09-MIDDAY-REDESIGN §5.1–5.3, T1.4).
 *
 * Pure Node, zero dependencies. Reads the same literal color pairs declared
 * in `tooling/tailwind/theme.css` (kept in sync by hand — there are few
 * enough pairs that a CSS parser would add more risk than it removes) and
 * fails (exit 1) if any pair falls under its WCAG threshold:
 *   - normal text:      4.5:1
 *   - large text (≥18px or ≥14px bold): 3:1
 *   - non-text UI (icons, focus rings): 3:1
 *
 * Usage: node scripts/checks/contrast.mjs
 */

// ── Color math ──────────────────────────────────────────────────────────

/** Parse "#rgb", "#rrggbb", "rgb(r g b / a)", or "hsl(h s% l%)" into [r,g,b,a]. */
function parseColor(input) {
  const s = input.trim();

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return [r, g, b, 1];
  }

  const rgbMatch = /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)$/.exec(
    s,
  );
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    return [Number(r), Number(g), Number(b), a ? Number(a) : 1];
  }

  const hslMatch = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+))?\)$/.exec(
    s,
  );
  if (hslMatch) {
    const [, h, sPct, l, a] = hslMatch;
    return [...hslToRgb(Number(h), Number(sPct), Number(l)), a ? Number(a) : 1];
  }

  throw new Error(`Cannot parse color: ${input}`);
}

function hslToRgb(h, sPct, lPct) {
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/** Flatten a (possibly translucent) fg color onto an opaque bg color. */
function flatten([fr, fg, fb, fa], [br, bg, bb]) {
  return [
    fr * fa + br * (1 - fa),
    fg * fa + bg * (1 - fa),
    fb * fa + bb * (1 - fa),
  ];
}

function relativeLuminance([r, g, b]) {
  const chan = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [chan(r), chan(g), chan(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(fgInput, bgInput) {
  const bg = parseColor(bgInput);
  const fgParsed = parseColor(fgInput);
  const fg = fgParsed[3] < 1 ? flatten(fgParsed, bg) : fgParsed.slice(0, 3);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg.slice(0, 3));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Token pairs (mirrors tooling/tailwind/theme.css — update together) ──

const BACKGROUND = { light: "#ffffff", dark: "hsl(0 0% 5%)" };
const CARD = { light: "hsl(45 18% 96%)", dark: "hsl(0 0% 7%)" };

const PAIRS = [
  // [label, fg, bg, kind]  kind: "text" (4.5) | "large" (3) | "ui" (3)
  ["foreground/background", "hsl(0 0% 7%)", BACKGROUND.light, "text", "light"],
  ["foreground/background", "hsl(0 0% 98%)", BACKGROUND.dark, "text", "dark"],
  ["muted-foreground/background", "hsl(0 0% 38%)", BACKGROUND.light, "text", "light"],
  ["muted-foreground/background", "hsl(0 0% 53%)", BACKGROUND.dark, "text", "dark"],
  ["muted-foreground/card", "hsl(0 0% 38%)", CARD.light, "text", "light"],
  ["muted-foreground/card", "hsl(0 0% 53%)", CARD.dark, "text", "dark"],
  ["primary-foreground/primary", "hsl(0 0% 98%)", "hsl(240 5.9% 10%)", "text", "light"],
  ["primary-foreground/primary", "hsl(240 5.9% 10%)", "hsl(0 0% 98%)", "text", "dark"],
  ["destructive-foreground/destructive", "hsl(0 0% 98%)", "hsl(0 84.2% 48%)", "text", "light"],
  ["destructive-foreground/destructive", "hsl(0 0% 100%)", "hsl(359 100% 44%)", "text", "dark"],
  ["nav-icon/background (UI, non-text)", "#000000", BACKGROUND.light, "ui", "light"],
  ["nav-icon/background (UI, non-text)", "#666666", BACKGROUND.dark, "ui", "dark"],
  ["nav-label/background", "#666666", BACKGROUND.light, "text", "light"],
  ["nav-label/background", "#878787", BACKGROUND.dark, "text", "dark"],
  // status pills — text is small (11px), so held to the 4.5:1 "text" bar
  ["status-neutral-fg/bg", "#616161", "#f2f1ef", "text", "light"],
  ["status-neutral-fg/bg", "#878787", "#1d1d1d", "text", "dark"],
  ["status-default-fg/bg", "#1d1d1d", "#f2f1ef", "text", "light"], // bg approximated opaque (10% on white)
  ["status-default-fg/bg", "#f5f5f3", "#0c0c0c", "text", "dark"],
  ["status-success-fg/bg", "#007a3d", "#ddf1e4", "text", "light"],
  ["status-success-fg/bg", "#00c969", "#0c0c0c", "text", "dark"], // bg approximated opaque (10% on card)
  ["status-warning-fg/bg", "#8a6500", "#fdf3d9", "text", "light"], // bg approximated opaque (10% on white)
  ["status-warning-fg/bg", "#ffd02b", "#0c0c0c", "text", "dark"],
  ["status-info-fg/bg", "#1a56c4", "#ddebff", "text", "light"],
  ["status-info-fg/bg", "#4c8dff", "#0c0c0c", "text", "dark"],
  ["status-orange-fg/bg", "#b4470a", "#ffedd5", "text", "light"],
  ["status-orange-fg/bg", "#f97316", "#0c0c0c", "text", "dark"],
  ["status-destructive-fg/bg", "#c21f21", "#fde3e3", "text", "light"], // bg approximated opaque (10% on white)
  ["status-destructive-fg/bg", "#ff3638", "#0c0c0c", "text", "dark"],
];

const THRESHOLDS = { text: 4.5, large: 3, ui: 3, "dark-nav-label": 4.5 };

// ── Run ─────────────────────────────────────────────────────────────────

let failures = 0;
const rows = [];

for (const [label, fg, bg, kind, theme] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const threshold = THRESHOLDS[kind];
  const pass = ratio >= threshold;
  if (!pass) failures++;
  rows.push({ theme, label, fg, bg, ratio: ratio.toFixed(2), threshold, pass });
}

const colWidths = {
  theme: Math.max(...rows.map((r) => r.theme.length), 5),
  label: Math.max(...rows.map((r) => r.label.length), 5),
  ratio: 6,
};

function pad(str, width) {
  return String(str).padEnd(width, " ");
}

console.log(
  `${pad("theme", colWidths.theme)}  ${pad("pair", colWidths.label)}  ${pad(
    "ratio",
    colWidths.ratio,
  )}  min  status`,
);
console.log("-".repeat(colWidths.theme + colWidths.label + colWidths.ratio + 20));

for (const r of rows) {
  console.log(
    `${pad(r.theme, colWidths.theme)}  ${pad(r.label, colWidths.label)}  ${pad(
      r.ratio,
      colWidths.ratio,
    )}  ${String(r.threshold).padEnd(3)}  ${r.pass ? "PASS" : "FAIL"}`,
  );
}

console.log();
if (failures > 0) {
  console.error(`${failures}/${rows.length} pairs FAILED WCAG contrast.`);
  process.exit(1);
}
console.log(`All ${rows.length} pairs pass WCAG contrast.`);
