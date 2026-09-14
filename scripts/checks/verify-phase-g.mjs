#!/usr/bin/env node
/**
 * verify-phase-g.mjs — Gate Visual G2 & Responsive Overflow Audit
 *
 * 1. Horizontal overflow audit: verifies `document.documentElement.scrollWidth <= window.innerWidth`
 *    at 390px mobile viewport across all 26 authenticated routes.
 * 2. Multi-viewport & theme screenshot audit across 6 core representative routes:
 *    - Viewports: 390x844 (mobile), 768x1024 (tablet), 1440x900 (desktop)
 *    - Themes: light, dark
 *    - Saved to: .opencode/reports/assets/visual-audit/
 */

import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCREENSHOT_DIR = path.join(
  REPO_ROOT,
  ".opencode/reports/assets/visual-audit"
);

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function runBrowser(cmd) {
  return execSync(`agent-browser ${cmd}`, { encoding: "utf8", timeout: 35000 }).trim();
}

function runBrowserEval(jsExpr) {
  const sanitized = jsExpr.replace(/\r?\n/g, " ").replace(/"/g, '\\"');
  const jsonResult = runBrowser(`eval "(() => { return (${sanitized}); })()"`);
  try {
    return JSON.parse(jsonResult);
  } catch {
    return jsonResult;
  }
}

const ALL_ROUTES = [
  "/dashboard",
  "/pos",
  "/orders",
  "/quotes",
  "/delivery-notes",
  "/invoices",
  "/vendors",
  "/customers",
  "/catalog",
  "/catalog/categories",
  "/catalog/brands",
  "/catalog/suppliers",
  "/pricing",
  "/catalog/import",
  "/inventory",
  "/containers",
  "/payments",
  "/accounts-receivable",
  "/cash-closure",
  "/rates",
  "/marketplace",
  "/whatsapp",
  "/settings",
  "/users",
  "/audit",
  "/alerts",
];

const REPRESENTATIVE_ROUTES = [
  { name: "dashboard", route: "/dashboard" },
  { name: "orders", route: "/orders" },
  { name: "pos", route: "/pos" },
  { name: "catalog", route: "/catalog" },
  { name: "inventory", route: "/inventory" },
  { name: "settings", route: "/settings" },
];

const VIEWPORTS = [
  { name: "mobile-390", w: 390, h: 844 },
  { name: "tablet-768", w: 768, h: 1024 },
  { name: "desktop-1440", w: 1440, h: 900 },
];

async function main() {
  console.log("==================================================");
  console.log("👁️ Cendaro ERP — Phase G (Gate Visual G2 Audit)");
  console.log("==================================================\n");

  let allPass = true;

  // ----------------------------------------------------
  // Part 1: Horizontal Overflow Audit at 390px (Mobile)
  // ----------------------------------------------------
  console.log("--- [Part 1] Mobile 390px Horizontal Overflow Audit ---");
  runBrowser(`set viewport 390 844`);

  const overflowResults = [];
  for (let i = 0; i < ALL_ROUTES.length; i++) {
    const route = ALL_ROUTES[i];
    runBrowser(`open "${BASE_URL}${route}"`);
    runBrowser(`wait 1800`);

    const metrics = runBrowserEval(`{
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth
    }`);

    const ok = !metrics.hasHorizontalOverflow;
    if (!ok) {
      allPass = false;
      console.error(`  ❌ [${i + 1}/${ALL_ROUTES.length}] ${route} OVERFLOW: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`);
    } else {
      console.log(`  ✓ [${i + 1}/${ALL_ROUTES.length}] ${route} (scrollWidth=${metrics.scrollWidth} <= 390)`);
    }

    overflowResults.push({ route, ok, ...metrics });
  }

  // ----------------------------------------------------
  // Part 2: Multi-Viewport & Multi-Theme Visual Capture
  // ----------------------------------------------------
  console.log("\n--- [Part 2] Multi-Viewport & Theme Visual Capture ---");
  let capturedCount = 0;

  for (const vp of VIEWPORTS) {
    runBrowser(`set viewport ${vp.w} ${vp.h}`);

    for (const theme of ["light", "dark"]) {
      runBrowser(`set media ${theme}`);

      for (const item of REPRESENTATIVE_ROUTES) {
        const url = `${BASE_URL}${item.route}`;
        const filename = `${item.name}-${vp.name}-${theme}.png`;
        const filePath = path.join(SCREENSHOT_DIR, filename);

        runBrowser(`open "${url}"`);
        runBrowser(`wait 1500`);
        runBrowser(`screenshot "${filePath}"`);
        capturedCount++;
        console.log(`  📸 Captured [${capturedCount}/36]: ${filename}`);
      }
    }
  }

  // Reset back to standard desktop light
  runBrowser(`set viewport 1440 900`);
  runBrowser(`set media light`);

  console.log("\n==================================================");
  console.log(`Total Screenshots Captured: ${capturedCount}`);
  console.log(`Saved in: ${SCREENSHOT_DIR}`);

  if (allPass) {
    console.log("🎉 Phase G (Gate Visual G2) Fully Verified & Certified!");
    process.exit(0);
  } else {
    console.error("❌ Horizontal overflow detected on mobile viewport.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
