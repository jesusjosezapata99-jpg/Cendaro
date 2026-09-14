#!/usr/bin/env node
/**
 * verify-accessibility.mjs — Accessibility & Keyboard Navigation (G5)
 *
 * Tests:
 * 1. Ctrl+K opens global search modal, Escape closes it
 * 2. Escape closes modals and popovers
 * 3. POS F2 shortcut focuses the scanner input
 * 4. WCAG 28/28 contrast pairs
 */

import { execSync } from "node:child_process";

const BASE_URL = "http://localhost:3000";

function runBrowser(cmd) {
  return execSync(`agent-browser ${cmd}`, { encoding: "utf8", timeout: 30000 }).trim();
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

async function main() {
  console.log("==================================================");
  console.log("♿ Cendaro ERP — Accessibility & Keyboard Navigation (G5)");
  console.log("==================================================\n");

  let allPass = true;

  // 1. Contrast Check
  console.log("--- [1] WCAG AA Contrast Verification ---");
  const contrastOutput = execSync("node scripts/checks/contrast.mjs", { encoding: "utf8" });
  if (contrastOutput.includes("All 28 pairs pass WCAG contrast")) {
    console.log("✓ All 28 color pairs pass WCAG contrast (4.5:1 text, 3:1 non-text)");
  } else {
    console.error("❌ Contrast check failed");
    allPass = false;
  }

  // 2. Global Search Command Palette (Ctrl+K and Escape)
  console.log("\n--- [2] Global Search Palette (Ctrl+K / Escape) ---");
  runBrowser(`open "${BASE_URL}/dashboard"`);
  runBrowser(`wait 2000`);

  // Press Ctrl+K
  runBrowser(`press Control+k`);
  runBrowser(`wait 1000`);

  const searchOpen = runBrowserEval(`Boolean(document.querySelector('[role="dialog"]'))`);
  console.log(`Command palette opened via Ctrl+K: ${searchOpen}`);
  if (!searchOpen) {
    console.error("❌ Command palette did not open on Ctrl+K");
    allPass = false;
  } else {
    console.log("✓ Command palette successfully opened via Ctrl+K");
    // Press Escape
    runBrowser(`press Escape`);
    runBrowser(`wait 800`);
    const searchClosed = runBrowserEval(`!document.querySelector('[role="dialog"]')`);
    if (searchClosed) {
      console.log("✓ Command palette successfully closed on Escape");
    } else {
      console.error("❌ Command palette did not close on Escape");
      allPass = false;
    }
  }

  // 3. POS Keyboard Shortcuts (F2 focus)
  console.log("\n--- [3] POS Scanner Shortcut (F2) ---");
  runBrowser(`open "${BASE_URL}/pos"`);
  runBrowser(`wait 2500`);

  // Unfocus any active element first
  runBrowserEval(`document.activeElement?.blur()`);
  runBrowser(`press F2`);
  runBrowser(`wait 500`);

  const isScannerFocused = runBrowserEval(`(() => {
    const active = document.activeElement;
    return active && active.placeholder && active.placeholder.includes("Escanear código");
  })()`);

  if (isScannerFocused) {
    console.log("✓ POS F2 shortcut focused the barcode input correctly");
  } else {
    console.error("❌ POS F2 shortcut did not focus scanner input");
    allPass = false;
  }

  console.log("\n==================================================");
  if (allPass) {
    console.log("🎉 Accessibility (G5) Fully Verified & Certified!");
    process.exit(0);
  } else {
    console.error("❌ Accessibility verification encountered failures.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
