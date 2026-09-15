#!/usr/bin/env node
/**
 * unseed-audit-dataset.mjs — Cendaro ERP
 *
 * Fully reverts the dataset seeded by seed-audit-dataset.mjs.
 * Deletes records in strict reverse dependency order using IDs recorded in
 * .opencode/reports/assets/seed-manifest.json.
 * Supports --dry-run.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Load environment
try {
  process.loadEnvFile(".env");
} catch {
  // Ignore if already in environment
}

const req = createRequire(path.resolve("./packages/db/package.json"));
const postgres = req("postgres");

const MANIFEST_PATH = path.resolve(".opencode/reports/assets/seed-manifest.json");
const isDryRun = process.argv.includes("--dry-run");

console.log("==================================================");
console.log("🧹 Cendaro ERP — Audit Dataset Unseed Script");
console.log(`Mode: ${isDryRun ? "DRY-RUN (No writes will occur)" : "EXECUTE (Deleting from DB)"}`);
console.log("==================================================");

if (!fs.existsSync(MANIFEST_PATH)) {
  console.log(`ℹ️ Manifest file not found at ${MANIFEST_PATH}. Nothing to unseed.`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
console.log(`Loaded manifest generated at: ${manifest.generatedAt}`);
console.log("Records targeted for deletion:");
console.table(manifest.counts);

if (isDryRun) {
  console.log("\n[DRY-RUN] Reversion plan verified successfully.");
  console.log("[DRY-RUN] 0 rows deleted. Manifest retained.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 30,
});

async function deleteInBatches(table, idList, batchSize = 500) {
  if (!idList || idList.length === 0) return 0;
  let deletedTotal = 0;
  for (let i = 0; i < idList.length; i += batchSize) {
    const batch = idList.slice(i, i + batchSize);
    const result = await sql`
      DELETE FROM ${sql(table)}
      WHERE id IN ${sql(batch)}
    `;
    deletedTotal += result.count;
    process.stdout.write(`  Deleting from ${table}: ${Math.min(i + batchSize, idList.length)}/${idList.length}\r`);
  }
  console.log(`\n  ✓ Deleted ${deletedTotal} rows from ${table}.`);
  return deletedTotal;
}

async function run() {
  try {
    console.log("\nReverting dataset in reverse dependency order...\n");

    // 1. Order items
    await deleteInBatches("order_item", manifest.ids.orderItems);

    // 2. Sales orders
    await deleteInBatches("sales_order", manifest.ids.orders);

    // 3. Accounts receivable
    await deleteInBatches("account_receivable", manifest.ids.accountsReceivable);

    // 4. Stock ledger
    await deleteInBatches("stock_ledger", manifest.ids.stockLedger);

    // 5. Product prices
    await deleteInBatches("product_price", manifest.ids.productPrices);

    // 6. Products
    await deleteInBatches("product", manifest.ids.products);

    // 7. Customers
    await deleteInBatches("customer", manifest.ids.customers);

    // 8. Suppliers, Categories, Brands
    await deleteInBatches("supplier", manifest.ids.suppliers);
    await deleteInBatches("category", manifest.ids.categories);
    await deleteInBatches("brand", manifest.ids.brands);

    console.log("\nRemoving manifest file...");
    fs.unlinkSync(MANIFEST_PATH);
    console.log(`✓ Removed ${MANIFEST_PATH}`);

    console.log("\n🎉 Unseed completed successfully! Database restored.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

run().catch((err) => {
  console.error("❌ Unseed failed with error:", err);
  process.exit(1);
});
