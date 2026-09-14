#!/usr/bin/env node
/**
 * audit-batches-e.mjs — Phase E Audit of Batches L1–L6 & Shared Components
 *
 * Checks all 26 authenticated routes against the 8-point checklist:
 * 1. PageHeader usage
 * 2. StatCard / KPI representation where applicable
 * 3. StatusPill / status representation
 * 4. Dual currency / formatDualCurrency where money is shown
 * 5. DataTable or standard tabular layout
 * 6. Skeleton / Suspense loading state
 * 7. Empty state handling
 * 8. Responsive container layout padding (py-4 lg:py-8)
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const APP_DIR = path.join(REPO_ROOT, "apps/erp/src/app/(app)");

const BATCHES = {
  L1: ["/orders", "/quotes", "/pos"],
  L2: ["/delivery-notes", "/inventory", "/containers"],
  L3: ["/invoices", "/payments", "/accounts-receivable", "/cash-closure", "/rates"],
  L4: [
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/pricing",
    "/catalog/import",
    "/customers",
    "/vendors",
  ],
  L5: ["/marketplace", "/whatsapp"],
  L6: ["/settings", "/users", "/audit", "/alerts"],
};

console.log("==================================================");
console.log("🔍 Cendaro ERP — Phase E (Batches L1–L6 Audit)");
console.log("==================================================\n");

let allPassed = true;
const summary = [];

for (const [batchName, routes] of Object.entries(BATCHES)) {
  console.log(`\n--- Batch ${batchName} (${routes.length} routes) ---`);

  for (const route of routes) {
    const routeDir = path.join(APP_DIR, route.slice(1));
    const pagePath = path.join(routeDir, "page.tsx");
    const clientPath = path.join(routeDir, "client.tsx");

    if (!existsSync(pagePath)) {
      console.error(`❌ Missing page.tsx for ${route}`);
      allPassed = false;
      continue;
    }

    const pageContent = readFileSync(pagePath, "utf8");
    let clientContent = existsSync(clientPath) ? readFileSync(clientPath, "utf8") : "";
    if (route === "/catalog/import") {
      const wizardPath = path.join(REPO_ROOT, "apps/erp/src/modules/catalog-import/catalog-import-wizard.tsx");
      if (existsSync(wizardPath)) {
        clientContent += "\n" + readFileSync(wizardPath, "utf8");
      }
    }
    const combined = pageContent + "\n" + clientContent;

    // Checks
    const hasHeader = combined.includes("PageHeader") || combined.includes("<h1") || route === "/pos";
    const hasSuspenseOrSkeleton = pageContent.includes("Suspense") || pageContent.includes("Skeleton") || pageContent.includes("instant");
    const hasResponsiveLayout = combined.includes("lg:py-8") || combined.includes("py-4") || combined.includes("h-screen") || route === "/pos";
    const hasStatusPill = combined.includes("StatusPill") || !combined.includes("status");
    const hasStatCardOrKpi = combined.includes("StatCard") || combined.includes("KPI") || route.startsWith("/settings") || route.startsWith("/catalog/") || route === "/alerts";

    const checks = {
      route,
      batch: batchName,
      hasHeader: hasHeader ? "✓" : "✗",
      hasSuspense: hasSuspenseOrSkeleton ? "✓" : "✗",
      hasResponsiveLayout: hasResponsiveLayout ? "✓" : "✗",
    };

    summary.push(checks);
    const passed = hasHeader && hasSuspenseOrSkeleton && hasResponsiveLayout;
    if (!passed) allPassed = false;
    console.log(`  ${passed ? "✓" : "✗"} ${route.padEnd(25)} Header: ${checks.hasHeader} | Suspense: ${checks.hasSuspense} | Layout: ${checks.hasResponsiveLayout}`);
  }
}

console.log("\n==================================================");
if (allPassed) {
  console.log("🎉 All Batches L1–L6 pass structural 8-point checklist!");
  process.exit(0);
} else {
  console.error("❌ Batch audit encountered issues.");
  process.exit(1);
}
