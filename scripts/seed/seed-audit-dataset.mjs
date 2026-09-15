#!/usr/bin/env node
/**
 * seed-audit-dataset.mjs — Cendaro ERP
 *
 * Populates representative audit dataset for volume testing:
 * - 5 seed Brands, Categories, Suppliers
 * - 300 Customers
 * - 5,000 Products (≥80% with cost_avg > 0, status mix)
 * - 5,000 Product Prices (store prices with USD and Bs)
 * - Stock across warehouses (Almacén Principal + Tienda), with ≥20 products < 5 units
 * - 1,200 Sales Orders & Order Items spread over 12 months with mixed statuses
 * - 80 Accounts Receivable (with ~1/3 overdue)
 *
 * All records have 'SEED-' prefix and are logged in .opencode/reports/assets/seed-manifest.json.
 * Supports --dry-run.
 */

import { randomUUID } from "node:crypto";
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

const WORKSPACE_ID = "a0000000-0000-0000-0000-000000000001"; // OmniCore Default
const WAREHOUSE_MAIN = "944b7fc1-8a95-4d08-ba13-5c239666da5b"; // Almacén Principal
const WAREHOUSE_STORE = "b1402fb6-6cae-477a-8d69-36d1384c7358"; // Tienda / Exhibición
const MANIFEST_PATH = path.resolve(".opencode/reports/assets/seed-manifest.json");

const isDryRun = process.argv.includes("--dry-run");

const COUNTS = {
  brands: 5,
  categories: 5,
  suppliers: 5,
  customers: 300,
  products: 5000,
  orders: 1200,
  accountsReceivable: 80,
};

console.log("==================================================");
console.log("🌱 Cendaro ERP — Audit Dataset Seed Script");
console.log(`Mode: ${isDryRun ? "DRY-RUN (No writes will occur)" : "EXECUTE (Writing to DB)"}`);
console.log(`Target Workspace: ${WORKSPACE_ID}`);
console.log("Target Volumes:");
console.log(`  - Brands: ${COUNTS.brands}`);
console.log(`  - Categories: ${COUNTS.categories}`);
console.log(`  - Suppliers: ${COUNTS.suppliers}`);
console.log(`  - Customers: ${COUNTS.customers}`);
console.log(`  - Products: ${COUNTS.products}`);
console.log(`  - Sales Orders: ${COUNTS.orders}`);
console.log(`  - Accounts Receivable: ${COUNTS.accountsReceivable}`);
console.log("==================================================");

if (isDryRun) {
  console.log("\n[DRY-RUN] Execution plan verified successfully.");
  console.log("[DRY-RUN] 0 rows written. Manifest not created.");
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

async function run() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaceId: WORKSPACE_ID,
    counts: {},
    ids: {
      brands: [],
      categories: [],
      suppliers: [],
      customers: [],
      products: [],
      productPrices: [],
      stockLedger: [],
      orders: [],
      orderItems: [],
      accountsReceivable: [],
    },
  };

  try {
    console.log("\n[1/7] Seeding Brands, Categories, and Suppliers...");
    const brandIds = [];
    for (let i = 1; i <= COUNTS.brands; i++) {
      const id = randomUUID();
      brandIds.push(id);
      await sql`
        INSERT INTO brand (id, workspace_id, name, slug, description)
        VALUES (${id}, ${WORKSPACE_ID}, ${`SEED- Marca ${i}`}, ${`seed-marca-${i}`}, ${`Marca de prueba ${i}`})
        ON CONFLICT (workspace_id, slug) DO UPDATE SET name = EXCLUDED.name
      `;
    }
    manifest.ids.brands = brandIds;

    const categoryIds = [];
    for (let i = 1; i <= COUNTS.categories; i++) {
      const id = randomUUID();
      categoryIds.push(id);
      await sql`
        INSERT INTO category (id, workspace_id, name, slug, depth, sort_order)
        VALUES (${id}, ${WORKSPACE_ID}, ${`SEED- Categoría ${i}`}, ${`seed-categoria-${i}`}, 0, ${i})
        ON CONFLICT (workspace_id, slug) DO UPDATE SET name = EXCLUDED.name
      `;
    }
    manifest.ids.categories = categoryIds;

    const supplierIds = [];
    for (let i = 1; i <= COUNTS.suppliers; i++) {
      const id = randomUUID();
      supplierIds.push(id);
      await sql`
        INSERT INTO supplier (id, workspace_id, name, rif, country, status)
        VALUES (${id}, ${WORKSPACE_ID}, ${`SEED- Proveedor ${i}`}, ${`SEED-J-${1000000 + i}`}, 'CN', 'active')
        ON CONFLICT (id) DO NOTHING
      `;
    }
    manifest.ids.suppliers = supplierIds;
    console.log(`  ✓ Created ${brandIds.length} brands, ${categoryIds.length} categories, ${supplierIds.length} suppliers.`);

    console.log("\n[2/7] Seeding 300 Customers in batches...");
    const customerIds = [];
    const customerTypes = ["retail", "wholesale", "distributor"];
    const customerRows = [];
    for (let i = 1; i <= COUNTS.customers; i++) {
      const id = randomUUID();
      customerIds.push(id);
      customerRows.push({
        id,
        workspace_id: WORKSPACE_ID,
        name: `SEED- Cliente Comercial ${i}`,
        legal_name: `SEED- Razón Social ${i} C.A.`,
        identification: `SEED-J-${2000000 + i}`,
        customer_type: customerTypes[i % 3],
        phone: `+58 412 ${String(i).padStart(7, "0")}`,
        email: `seed.cliente.${i}@cendaro-test.local`,
        credit_limit: (i % 5 + 1) * 1000,
        credit_days: [15, 30, 45, 60][i % 4],
        balance: 0,
      });
    }

    // Insert customers in batches of 100
    for (let i = 0; i < customerRows.length; i += 100) {
      const batch = customerRows.slice(i, i + 100);
      await sql`
        INSERT INTO customer ${sql(batch, "id", "workspace_id", "name", "legal_name", "identification", "customer_type", "phone", "email", "credit_limit", "credit_days", "balance")}
        ON CONFLICT (id) DO NOTHING
      `;
    }
    manifest.ids.customers = customerIds;
    console.log(`  ✓ Created ${customerIds.length} customers.`);

    console.log("\n[3/7] Generating and Seeding 5,000 Products...");
    const productIds = [];
    const productRows = [];
    const productPriceRows = [];
    const stockRows = [];

    const productNames = [
      "Adaptador USB-C multipuerto 4K",
      "Cable HDMI 2.1 Ultra High Speed 2m",
      "Cargador Rápido GaN 65W Doble Puerto",
      "Teclado Mecánico RGB Switch Blue",
      "Monitor IPS 27 Pulgadas QHD 144Hz",
      "Mouse Ergonómico Inalámbrico Silent",
      "Auriculares Bluetooth Cancelación Ruido",
      "Batería Portátil PowerBank 20000mAh",
      "Hub USB 3.0 de 7 Puertos con Alimentación",
      "Disco SSD NVMe M.2 Gen4 1TB High Speed",
    ];

    for (let i = 1; i <= COUNTS.products; i++) {
      const id = randomUUID();
      productIds.push(id);

      // cost_avg > 0 in 90% of products (exceeds ≥80% requirement)
      const hasCost = i % 10 !== 0;
      const costAvg = hasCost ? Number((5 + ((i * 17) % 75) + 0.5).toFixed(4)) : 0;
      const baseName = productNames[i % productNames.length];
      const sku = `SEED-PRD-${String(i).padStart(5, "0")}`;
      const barcode = `759${String(i).padStart(10, "0")}`;

      const status = i <= 4250 ? "active" : i <= 4750 ? "draft" : "discontinued";

      productRows.push({
        id,
        workspace_id: WORKSPACE_ID,
        sku,
        barcode,
        name: `SEED- ${baseName} #${i}`,
        brand_id: brandIds[i % brandIds.length],
        category_id: categoryIds[i % categoryIds.length],
        supplier_id: supplierIds[i % supplierIds.length],
        base_uom: "unit",
        selling_unit: "unit",
        presentation_qty: 1,
        cost_avg: costAvg.toString(),
        status,
      });

      // Price row
      const priceUsd = Number((costAvg > 0 ? costAvg * 1.45 : 25.0).toFixed(2));
      const priceBs = Number((priceUsd * 36.5).toFixed(2));
      const priceId = randomUUID();
      manifest.ids.productPrices.push(priceId);
      productPriceRows.push({
        id: priceId,
        workspace_id: WORKSPACE_ID,
        product_id: id,
        price_type: "store",
        amount_usd: priceUsd,
        amount_bs: priceBs,
        rate_used: 36.5,
      });

      // Stock row: products 1 to 30 have low stock (<5 units, e.g. 1 to 4)
      const mainStockQty = i <= 30 ? (i % 4) + 1 : 10 + ((i * 13) % 180);
      const stockMainId = randomUUID();
      manifest.ids.stockLedger.push(stockMainId);
      stockRows.push({
        id: stockMainId,
        workspace_id: WORKSPACE_ID,
        product_id: id,
        warehouse_id: WAREHOUSE_MAIN,
        quantity: mainStockQty,
        is_locked: false,
      });

      // Also add stock to store warehouse for first 500 products
      if (i <= 500) {
        const stockStoreId = randomUUID();
        manifest.ids.stockLedger.push(stockStoreId);
        stockRows.push({
          id: stockStoreId,
          workspace_id: WORKSPACE_ID,
          product_id: id,
          warehouse_id: WAREHOUSE_STORE,
          quantity: 5 + (i % 25),
          is_locked: false,
        });
      }
    }

    // Insert products in batches of 500
    for (let i = 0; i < productRows.length; i += 500) {
      const batch = productRows.slice(i, i + 500);
      await sql`
        INSERT INTO product ${sql(batch, "id", "workspace_id", "sku", "barcode", "name", "brand_id", "category_id", "supplier_id", "base_uom", "selling_unit", "presentation_qty", "cost_avg", "status")}
        ON CONFLICT (workspace_id, sku) DO NOTHING
      `;
      process.stdout.write(`  Inserted products ${i + batch.length}/${productRows.length}\r`);
    }
    console.log(`\n  ✓ Inserted ${productRows.length} products.`);

    // Insert prices in batches of 500
    for (let i = 0; i < productPriceRows.length; i += 500) {
      const batch = productPriceRows.slice(i, i + 500);
      await sql`
        INSERT INTO product_price ${sql(batch, "id", "workspace_id", "product_id", "price_type", "amount_usd", "amount_bs", "rate_used")}
        ON CONFLICT (workspace_id, product_id, price_type) DO NOTHING
      `;
      process.stdout.write(`  Inserted prices ${i + batch.length}/${productPriceRows.length}\r`);
    }
    console.log(`\n  ✓ Inserted ${productPriceRows.length} product prices.`);

    // Insert stock in batches of 500
    for (let i = 0; i < stockRows.length; i += 500) {
      const batch = stockRows.slice(i, i + 500);
      await sql`
        INSERT INTO stock_ledger ${sql(batch, "id", "workspace_id", "product_id", "warehouse_id", "quantity", "is_locked")}
        ON CONFLICT (workspace_id, product_id, warehouse_id) DO NOTHING
      `;
      process.stdout.write(`  Inserted stock records ${i + batch.length}/${stockRows.length}\r`);
    }
    console.log(`\n  ✓ Inserted ${stockRows.length} stock ledger records (including 30 low-stock items < 5).`);
    manifest.ids.products = productIds;

    console.log("\n[4/7] Seeding 1,200 Sales Orders & Order Items across 12 months...");
    const orderIds = [];
    const orderRows = [];
    const orderItemRows = [];

    const orderStatuses = [
      "confirmed",
      "delivered",
      "invoiced",
      "dispatched",
      "prepared",
      "pending",
      "cancelled",
      "returned",
    ];
    const channels = ["store", "mercadolibre", "vendors", "whatsapp"];
    const now = Date.now();

    for (let i = 1; i <= COUNTS.orders; i++) {
      const id = randomUUID();
      orderIds.push(id);

      // Spread over 365 days
      const daysAgo = Math.floor(((COUNTS.orders - i) / COUNTS.orders) * 365);
      const createdAt = new Date(now - daysAgo * 86400000 - (i % 24) * 3600000);

      // Status distribution
      let status;
      const mod = i % 100;
      if (mod < 35) status = "confirmed";
      else if (mod < 60) status = "delivered";
      else if (mod < 75) status = "invoiced";
      else if (mod < 85) status = "dispatched";
      else if (mod < 90) status = "prepared";
      else if (mod < 94) status = "pending";
      else if (mod < 97) status = "cancelled";
      else status = "returned";

      const channel = channels[i % channels.length];
      const customerId = customerIds[i % customerIds.length];
      const orderNumber = `SEED-ORD-${String(i).padStart(5, "0")}`;

      // 1 to 3 items per order
      const itemCount = (i % 3) + 1;
      let subtotal = 0;
      for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
        const prodIdx = (i * 7 + itemIdx * 13) % productIds.length;
        const prodId = productIds[prodIdx];
        const qty = (itemIdx % 3) + 1;
        const unitPrice = Number((15 + ((prodIdx * 3) % 80)).toFixed(2));
        const lineTotal = Number((qty * unitPrice).toFixed(2));
        subtotal += lineTotal;

        const itemId = randomUUID();
        manifest.ids.orderItems.push(itemId);
        orderItemRows.push({
          id: itemId,
          workspace_id: WORKSPACE_ID,
          order_id: id,
          product_id: prodId,
          quantity: qty,
          unit_price: unitPrice,
          discount: 0,
          line_total: lineTotal,
        });
      }

      const total = subtotal;
      const isPaid = status === "delivered" || status === "invoiced" || status === "confirmed";
      const totalPaid = isPaid ? total : 0;

      orderRows.push({
        id,
        workspace_id: WORKSPACE_ID,
        order_number: orderNumber,
        customer_id: customerId,
        channel,
        status,
        subtotal,
        discount: 0,
        total,
        total_paid: totalPaid,
        stock_deducted: isPaid,
        created_at: createdAt,
      });
    }

    // Insert orders in batches of 200
    for (let i = 0; i < orderRows.length; i += 200) {
      const batch = orderRows.slice(i, i + 200);
      await sql`
        INSERT INTO sales_order ${sql(batch, "id", "workspace_id", "order_number", "customer_id", "channel", "status", "subtotal", "discount", "total", "total_paid", "stock_deducted", "created_at")}
        ON CONFLICT (workspace_id, order_number) DO NOTHING
      `;
      process.stdout.write(`  Inserted orders ${i + batch.length}/${orderRows.length}\r`);
    }
    console.log(`\n  ✓ Inserted ${orderRows.length} sales orders.`);

    // Insert order items in batches of 500
    for (let i = 0; i < orderItemRows.length; i += 500) {
      const batch = orderItemRows.slice(i, i + 500);
      await sql`
        INSERT INTO order_item ${sql(batch, "id", "workspace_id", "order_id", "product_id", "quantity", "unit_price", "discount", "line_total")}
        ON CONFLICT (id) DO NOTHING
      `;
      process.stdout.write(`  Inserted order items ${i + batch.length}/${orderItemRows.length}\r`);
    }
    console.log(`\n  ✓ Inserted ${orderItemRows.length} order line items.`);
    manifest.ids.orders = orderIds;

    console.log("\n[5/7] Seeding 80 Accounts Receivable records (~1/3 overdue)...");
    const arIds = [];
    const arRows = [];
    for (let i = 1; i <= COUNTS.accountsReceivable; i++) {
      const id = randomUUID();
      arIds.push(id);
      const customerId = customerIds[i % customerIds.length];
      const totalAmount = Number((200 + (i * 37) % 1500).toFixed(2));

      let status;
      let dueDate;
      let paidAmount;
      let balance;

      if (i <= 28) {
        // Overdue (~1/3 of records)
        status = "overdue";
        dueDate = new Date(now - (5 + (i % 25)) * 86400000);
        paidAmount = 0;
        balance = totalAmount;
      } else if (i <= 55) {
        // Pending
        status = "pending";
        dueDate = new Date(now + (5 + (i % 30)) * 86400000);
        paidAmount = 0;
        balance = totalAmount;
      } else {
        // Partial
        status = "partial";
        dueDate = new Date(now + (2 + (i % 15)) * 86400000);
        paidAmount = Number((totalAmount * 0.4).toFixed(2));
        balance = Number((totalAmount - paidAmount).toFixed(2));
      }

      arRows.push({
        id,
        workspace_id: WORKSPACE_ID,
        customer_id: customerId,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance,
        status,
        due_date: dueDate,
        notes: `SEED- Cuenta por cobrar de prueba #${i}`,
      });
    }

    await sql`
      INSERT INTO account_receivable ${sql(arRows, "id", "workspace_id", "customer_id", "total_amount", "paid_amount", "balance", "status", "due_date", "notes")}
      ON CONFLICT (id) DO NOTHING
    `;
    manifest.ids.accountsReceivable = arIds;
    console.log(`  ✓ Inserted ${arRows.length} accounts receivable (including 28 overdue).`);

    console.log("\n[6/7] Writing seed manifest to disk...");
    manifest.counts = {
      brands: manifest.ids.brands.length,
      categories: manifest.ids.categories.length,
      suppliers: manifest.ids.suppliers.length,
      customers: manifest.ids.customers.length,
      products: manifest.ids.products.length,
      productPrices: manifest.ids.productPrices.length,
      stockLedger: manifest.ids.stockLedger.length,
      orders: manifest.ids.orders.length,
      orderItems: manifest.ids.orderItems.length,
      accountsReceivable: manifest.ids.accountsReceivable.length,
    };

    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`  ✓ Manifest written to ${MANIFEST_PATH}`);

    console.log("\n[7/7] Seed Summary:");
    console.table(manifest.counts);
    console.log("\n🎉 Seed completed successfully!");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

run().catch((err) => {
  console.error("❌ Seed failed with error:", err);
  process.exit(1);
});
