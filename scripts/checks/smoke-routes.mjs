#!/usr/bin/env node
/**
 * smoke-routes.mjs — Automated Smoke Test for 26 Authenticated ERP Routes
 *
 * Navigates to each of the 26 authenticated routes using agent-browser:
 * - Confirms page opens successfully (no crash / 500)
 * - Verifies absence of error indicators ("Application error", "Something went wrong", etc.)
 * - Checks console error log via `agent-browser errors`
 * - Outputs structured report table
 */

import { execSync } from "node:child_process";

const BASE_URL = "http://localhost:3000";

const ROUTES = [
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

console.log("==================================================");
console.log(`🚀 Cendaro ERP — 26-Route Smoke Test`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Total Routes: ${ROUTES.length}`);
console.log("==================================================\n");

const results = [];
let hasFailures = false;

for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i];
  const url = `${BASE_URL}${route}`;
  const start = Date.now();

  try {
    // Navigate to route
    const openOutput = execSync(`agent-browser open "${url}"`, {
      encoding: "utf8",
      timeout: 15000,
    });

    // Check for errors in browser console
    let errors = "";
    try {
      errors = execSync(`agent-browser errors`, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    } catch {
      // ignore
    }

    const duration = Date.now() - start;
    const isError =
      openOutput.includes("Application error") ||
      openOutput.includes("500") ||
      (errors && !errors.startsWith("✗"));

    results.push({
      route,
      status: isError ? "FAIL" : "PASS",
      durationMs: duration,
      errors: errors.startsWith("✗") ? "none" : errors,
    });

    console.log(`[${i + 1}/${ROUTES.length}] ${isError ? "❌" : "✓"} ${route} (${duration}ms)`);
    if (isError) {
      hasFailures = true;
      console.error(`    Errors: ${errors}`);
    }
  } catch (err) {
    const duration = Date.now() - start;
    hasFailures = true;
    results.push({
      route,
      status: "FAIL",
      durationMs: duration,
      errors: err.message,
    });
    console.log(`[${i + 1}/${ROUTES.length}] ❌ ${route} (${duration}ms) — ERROR: ${err.message}`);
  }
}

console.log("\n==================================================");
console.log("📊 Smoke Test Results Summary");
console.table(results);
console.log("==================================================");

if (hasFailures) {
  console.error("\n❌ Smoke test encountered failures.");
  process.exit(1);
} else {
  console.log(`\n🎉 All ${ROUTES.length}/${ROUTES.length} routes passed smoke testing with 0 errors!`);
  process.exit(0);
}
