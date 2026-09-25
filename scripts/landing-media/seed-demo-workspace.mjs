#!/usr/bin/env node
/**
 * Demo company for the landing recordings (PLAN-2026-09-LANDING-REDESIGN T3.1).
 *
 * Creates, in production and fully isolated from real data:
 *   - an auth user (owner) "demo.aurora" via the Supabase Admin API;
 *   - organization + workspace "Distribuidora Aurora" (enterprise, all 18
 *     modules) with its profile, quota and membership;
 *   - fictitious catalog, stock, customers, orders, payments, receivables,
 *     cash closures, a container read by AI, quotes, delivery notes, rates,
 *     alerts and Mercado Libre listings (scripts/landing-media/demo-data.mjs).
 *
 * All database rows are written in ONE transaction; if it fails, the auth
 * user is deleted again. The password is written only to `.env.landing-demo`
 * (git-ignored by `.env.*`) and never printed. Undo with
 * `node scripts/landing-media/unseed-demo-workspace.mjs`.
 *
 * Usage (repo root):
 *   node scripts/landing-media/seed-demo-workspace.mjs --dry-run
 *   node scripts/landing-media/seed-demo-workspace.mjs
 */
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { connect, insert, transaction } from "./db.mjs";
import {
  BRANDS,
  CATEGORIES,
  CONTAINER_ITEMS,
  CUSTOMERS,
  DEMO,
  ML_LISTINGS,
  PRODUCTS,
  RATES_TODAY,
  SUPPLIERS,
  WAREHOUSES,
} from "./demo-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CREDENTIALS_FILE = join(ROOT, ".env.landing-demo");
const DRY_RUN = process.argv.includes("--dry-run");
const DAY = 24 * 60 * 60 * 1000;

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // Variables may already be in the environment.
}

const ERP_MODULES = [
  "dashboard", "catalog", "inventory", "containers", "pricing", "rates",
  "pos", "orders", "customers", "vendors", "payments", "cash_closure",
  "receivables", "marketplace", "whatsapp", "users", "audit", "settings",
];

// ── Deterministic helpers ────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let random = mulberry32(20260925);
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const money = (n) => Math.round(n * 100) / 100;
const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** SENIAT RIF check digit (same algorithm as packages/validators/src/fiscal.ts). */
function rif(letter, digits) {
  const values = { V: 1, E: 2, J: 3, P: 4, G: 5 };
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = values[letter] * 4;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * weights[i];
  const digit = 11 - (sum % 11);
  return `${letter}-${digits}-${digit >= 10 ? 0 : digit}`;
}

/** A timestamp `days` ago at a given Venezuelan hour (UTC-4). */
function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour + 4, minute, 0, 0);
  return d;
}

// ── Build every row in memory first (also used by --dry-run) ─────────────
function buildDataset(ownerId) {
  random = mulberry32(20260925);
  const workspaceId = randomUUID();
  const organizationId = randomUUID();
  const ws = { workspace_id: workspaceId };

  const warehouses = WAREHOUSES.map((w) => ({
    id: randomUUID(), ...ws, name: w.name, type: w.type, location: w.location,
    is_active: true, created_at: daysAgo(60), key: w.key,
  }));
  const whId = Object.fromEntries(warehouses.map((w) => [w.key, w.id]));

  const categories = CATEGORIES.map((c, i) => ({
    id: randomUUID(), ...ws, name: c.name, slug: c.key, depth: 0, sort_order: i, key: c.key,
  }));
  const catId = Object.fromEntries(categories.map((c) => [c.key, c.id]));

  const brands = BRANDS.map((name) => ({ id: randomUUID(), ...ws, name, slug: slugify(name) }));

  const suppliers = SUPPLIERS.map((s, i) => ({
    id: randomUUID(), ...ws, name: s.name, country: s.country, contact_name: s.contact,
    status: "active",
    rif: s.country === "VE" ? rif("J", `3${String(1234560 + i * 7919).slice(0, 7)}`) : null,
    key: s.key,
  }));
  const supId = Object.fromEntries(suppliers.map((s) => [s.key, s.id]));

  const products = [];
  const prices = [];
  const ledger = [];
  const movements = [];
  for (const [sku, name, cat, brand, sup, cost, store, wholesale, central, tienda] of PRODUCTS) {
    const id = randomUUID();
    products.push({
      id, ...ws, sku, name, category_id: catId[cat], brand_id: brands[brand].id,
      supplier_id: supId[sup], cost_avg: cost, status: "active", base_uom: "unidad",
      selling_unit: "unidad", created_at: daysAgo(58), sku_key: sku, store, wholesale,
    });
    for (const [type, usd] of [["store", store], ["wholesale", wholesale]]) {
      prices.push({
        id: randomUUID(), ...ws, product_id: id, price_type: type, amount_usd: usd,
        amount_bs: money(usd * RATES_TODAY.bcv), rate_used: RATES_TODAY.bcv,
      });
    }
    for (const [key, qty] of [["central", central], ["tienda", tienda]]) {
      ledger.push({ id: randomUUID(), ...ws, product_id: id, warehouse_id: whId[key], quantity: qty, is_locked: false });
      movements.push({
        id: randomUUID(), ...ws, product_id: id, movement_type: "initial_stock", quantity: qty,
        warehouse_id: whId[key], notes: "Inventario inicial", created_by: ownerId,
        created_at: daysAgo(58, 9),
      });
    }
  }
  const productBySku = Object.fromEntries(products.map((p) => [p.sku_key, p]));
  for (const [sku, qty, days] of [["FER-006", 120, 3], ["LIM-007", 80, 2], ["HOG-002", 24, 1]]) {
    movements.push({
      id: randomUUID(), ...ws, product_id: productBySku[sku].id, movement_type: "transfer",
      quantity: qty, warehouse_id: whId.tienda, notes: "Reposición de tienda desde Almacén Central",
      created_by: ownerId, created_at: daysAgo(days, 15),
    });
  }
  movements.push({
    id: randomUUID(), ...ws, product_id: productBySku["LIM-004"].id, movement_type: "adjustment_out",
    quantity: 3, warehouse_id: whId.central, notes: "Ajuste por conteo físico",
    created_by: ownerId, created_at: daysAgo(4, 17),
  });

  const customers = CUSTOMERS.map(([name, type, idType, letter, number, phone, credit, days]) => ({
    id: randomUUID(), ...ws, name,
    legal_name: idType === "rif" && letter === "J" ? `${name}, C.A.` : name,
    identification: idType === "rif" ? rif(letter, number) : `${letter}-${number}`,
    customer_type: type, phone, address: "Valencia, Carabobo",
    credit_limit: credit, credit_days: days, balance: 0, created_at: daysAgo(between(35, 55)),
  }));

  // Rates: 21 daily syncs ending today at 6:00 p. m. Venezuela.
  const rates = [];
  for (let d = 20; d >= 0; d--) {
    const drift = Math.pow(1.0042, d);
    const at = daysAgo(d, 18);
    const date = at.toISOString().slice(0, 10);
    const round4 = (n) => Math.round(n * 10000) / 10000;
    rates.push(
      { id: randomUUID(), ...ws, rate_type: "bcv", rate: round4(RATES_TODAY.bcv / drift), source: `bcv-direct (auto-sync ${date})`, created_at: at },
      { id: randomUUID(), ...ws, rate_type: "parallel", rate: round4((RATES_TODAY.parallel / drift) * (1 + (random() - 0.5) * 0.004)), source: `dolarapi-paralelo (auto-sync ${date})`, created_at: at },
      { id: randomUUID(), ...ws, rate_type: "rmb_usd", rate: round4(RATES_TODAY.rmb_usd + (random() - 0.5) * 0.02), source: `frankfurter (auto-sync ${date})`, created_at: at },
    );
  }

  // Orders over the last 30 days.
  const orders = [];
  const items = [];
  const payments = [];
  const receivables = [];
  const methods = ["mobile_payment", "cash", "pos_terminal", "zelle", "transfer"];

  const paymentRow = (orderId, amount, method, customer, at) => ({
    id: randomUUID(), ...ws, order_id: orderId, method, amount,
    reference: method === "cash" ? null : String(between(100000, 999999)),
    bank_name: ["mobile_payment", "transfer"].includes(method)
      ? pick(["Banesco", "Mercantil", "Provincial", "BNC"])
      : null,
    payer_name: customer.name, payer_id_doc: customer.identification,
    is_validated: true, validated_by: ownerId,
    created_at: at.getTime() > Date.now() ? new Date() : at,
  });

  for (let i = 0; i < 38; i++) {
    const days = Math.floor(((37 - i) * 30) / 38);
    const customer = pick(customers);
    const wholesaleBuyer = ["wholesale", "distributor"].includes(customer.customer_type);
    const channel =
      customer.customer_type === "marketplace"
        ? "mercadolibre"
        : wholesaleBuyer
          ? random() < 0.5 ? "whatsapp" : "vendors"
          : "store";
    const createdAt = daysAgo(days, between(8, 17), between(0, 59));
    const orderId = randomUUID();
    let subtotal = 0;
    const used = new Set();
    const lines = between(1, wholesaleBuyer ? 5 : 3);
    for (let l = 0; l < lines; l++) {
      const product = pick(products);
      if (used.has(product.id)) continue;
      used.add(product.id);
      const quantity = wholesaleBuyer ? between(6, 48) : between(1, 4);
      const unit = wholesaleBuyer ? product.wholesale : product.store;
      const lineTotal = money(unit * quantity);
      subtotal += lineTotal;
      items.push({
        id: randomUUID(), ...ws, order_id: orderId, product_id: product.id, quantity,
        unit_price: unit, discount: 0, line_total: lineTotal,
      });
    }
    subtotal = money(subtotal);
    const status =
      days >= 6
        ? pick(["delivered", "delivered", "invoiced"])
        : days >= 2
          ? pick(["dispatched", "prepared", "confirmed"])
          : pick(["pending", "confirmed"]);
    const onCredit = wholesaleBuyer && customer.credit_days > 0 && random() < 0.6;
    const order = {
      id: orderId, ...ws, customer_id: customer.id, channel, status, subtotal, discount: 0,
      total: subtotal, total_paid: 0, created_by: ownerId, created_at: createdAt,
      updated_at: createdAt, stock_deducted: ["delivered", "invoiced", "dispatched"].includes(status),
    };
    orders.push(order);

    if (onCredit) {
      const due = new Date(createdAt.getTime() + customer.credit_days * DAY);
      receivables.push({
        id: randomUUID(), ...ws, customer_id: customer.id, order_id: orderId,
        total_amount: subtotal, paid_amount: 0, balance: subtotal,
        status: due.getTime() < Date.now() ? "overdue" : "pending",
        due_date: due, created_by: ownerId, created_at: createdAt,
      });
      const roll = random();
      if (roll < 0.45) {
        const amount = roll < 0.2 ? subtotal : money(subtotal * 0.5);
        payments.push(paymentRow(orderId, amount, "transfer", customer, new Date(createdAt.getTime() + between(2, 10) * DAY)));
        order.total_paid = amount;
      }
    } else if (status !== "pending") {
      payments.push(paymentRow(orderId, subtotal, pick(methods), customer, createdAt));
      order.total_paid = subtotal;
    }
  }

  // Cash closures for the last 7 days (store sales only).
  const storeOrders = new Set(orders.filter((o) => o.channel === "store").map((o) => o.id));
  const closures = [];
  for (let d = 7; d >= 1; d--) {
    const dayStart = daysAgo(d, 0).getTime();
    const dayPayments = payments.filter((p) => {
      const t = p.created_at.getTime();
      return storeOrders.has(p.order_id) && t >= dayStart && t < dayStart + DAY;
    });
    const cash = money(dayPayments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0));
    const digital = money(dayPayments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0));
    const expected = money(cash + digital);
    const discrepancy = d === 3 && cash > 0 ? -2.5 : 0;
    closures.push({
      id: randomUUID(), ...ws, closure_date: daysAgo(d, 19), status: d > 2 ? "reviewed" : "closed",
      total_sales: expected, total_cash: cash, total_digital: digital, expected_total: expected,
      actual_total: money(expected + discrepancy), discrepancy,
      notes: discrepancy ? "Diferencia por vuelto en efectivo" : null,
      closed_by: ownerId, reviewed_by: d > 2 ? ownerId : null, created_at: daysAgo(d, 19),
    });
  }

  // Containers: one received and closed, one in transit read by AI.
  const received = {
    id: randomUUID(), ...ws, container_number: "TGHU 7713502", supplier_id: supId.guangzhou,
    status: "closed", departure_date: daysAgo(80), arrival_date: daysAgo(42), cost_fob: 18640,
    notes: null, closed_by: ownerId, closed_at: daysAgo(40), created_by: ownerId,
    created_at: daysAgo(82), packing_list_status: "completed",
    packing_list_processed_at: daysAgo(81), packing_list_item_count: 4,
  };
  const inTransit = {
    id: randomUUID(), ...ws, container_number: "MSKU 4829137", supplier_id: supId.ningbo,
    status: "in_transit", departure_date: daysAgo(19), arrival_date: daysAgo(-12),
    cost_fob: money(CONTAINER_ITEMS.reduce((s, it) => s + it[3] * it[4], 0)),
    notes: "Naviera: Maersk. Puerto de destino: Puerto Cabello.",
    closed_by: null, closed_at: null, created_by: ownerId, created_at: daysAgo(21),
    packing_list_status: "completed", packing_list_processed_at: daysAgo(20),
    packing_list_item_count: CONTAINER_ITEMS.length,
  };
  const containerItems = CONTAINER_ITEMS.map(([original, translated, hint, qty, cost, sku, confidence]) => ({
    id: randomUUID(), ...ws, container_id: inTransit.id,
    product_id: sku ? productBySku[sku].id : null, quantity_expected: qty, quantity_received: 0,
    unit_cost: cost, original_name: original, translated_name: translated, sku_hint: hint,
    is_matched: Boolean(sku), confidence,
    suggested_product_id: sku ? productBySku[sku].id : null, ai_corrected: false,
    match_type: sku ? "exact_sku" : "no_match",
  }));
  for (const [sku, qty, cost] of [["FER-003", 600, 1.1], ["FER-004", 240, 3.2], ["FER-005", 360, 2.0], ["FER-008", 900, 0.62]]) {
    containerItems.push({
      id: randomUUID(), ...ws, container_id: received.id, product_id: productBySku[sku].id,
      quantity_expected: qty, quantity_received: qty, unit_cost: cost,
      original_name: productBySku[sku].name, translated_name: productBySku[sku].name,
      sku_hint: sku, is_matched: true, confidence: 0.96,
      suggested_product_id: productBySku[sku].id, ai_corrected: false, match_type: "exact_sku",
    });
  }

  // Quotes and delivery notes.
  const quotes = [];
  const quoteItems = [];
  const quoteSkus = [["LIM-001", "LIM-011"], ["FER-001", "FER-006"], ["HOG-001", "HOG-002", "HOG-008"], ["CUI-004", "LIM-002"]];
  ["sent", "accepted", "draft", "sent"].forEach((status, i) => {
    const customer = customers[[1, 3, 7, 16][i]];
    const id = randomUUID();
    let total = 0;
    for (const sku of quoteSkus[i]) {
      const p = productBySku[sku];
      const qty = between(12, 60);
      const line = money(p.wholesale * qty);
      total += line;
      quoteItems.push({
        id: randomUUID(), ...ws, quote_id: id, product_id: p.id, quantity: qty,
        unit_price: p.wholesale, discount: 0, line_total: line,
      });
    }
    quotes.push({
      id, ...ws, quote_number: `QTE-DEMO${i + 1}`, customer_id: customer.id, status,
      channel: "vendors", subtotal: money(total), discount: 0, total: money(total),
      valid_until: daysAgo(-10 + i), created_by: ownerId, created_at: daysAgo(6 - i, 11),
      updated_at: daysAgo(6 - i, 11),
    });
  });

  const deliveryNotes = [];
  const deliveryItems = [];
  orders
    .filter((o) => o.status === "dispatched")
    .slice(0, 3)
    .forEach((o, i) => {
      const id = randomUUID();
      deliveryNotes.push({
        id, ...ws, note_number: `NE-${String(1041 + i).padStart(5, "0")}`, order_id: o.id,
        status: "issued", delivery_address: "Valencia, Carabobo", dispatched_at: o.created_at,
        created_by: ownerId, created_at: o.created_at,
      });
      for (const it of items.filter((x) => x.order_id === o.id)) {
        deliveryItems.push({
          id: randomUUID(), ...ws, delivery_note_id: id, product_id: it.product_id,
          quantity_dispatched: it.quantity,
        });
      }
    });

  const alerts = [
    ...["LIM-010", "HOG-004", "CUI-005"].map((sku) => ({
      id: randomUUID(), ...ws, alert_type: "low_stock", severity: "warning",
      title: `Stock bajo: ${productBySku[sku].name}`,
      message: "Quedan pocas unidades en Almacén Central Valencia.",
      entity_type: "product", entity_id: productBySku[sku].id, is_dismissed: false,
      created_at: daysAgo(1, 8),
    })),
    {
      id: randomUUID(), ...ws, alert_type: "ar_overdue", severity: "high",
      title: "Cuentas por cobrar vencidas",
      message: "Hay ventas a crédito con el plazo vencido.",
      entity_type: "account_receivable", entity_id: receivables[0]?.id ?? workspaceId,
      is_dismissed: false, created_at: daysAgo(0, 8),
    },
  ];

  const listings = ML_LISTINGS.map(([sku, title, price], i) => ({
    id: randomUUID(), ...ws, product_id: productBySku[sku].id,
    ml_item_id: `MLV${874512300 + i * 37}`, title, status: "active", price,
    stock_synced: ledger.find((l) => l.product_id === productBySku[sku].id)?.quantity ?? 0,
    last_sync_at: daysAgo(0, 7), created_at: daysAgo(30),
  }));

  return {
    workspaceId, organizationId, warehouses, categories, brands, suppliers, products,
    prices, ledger, movements, customers, rates, orders, items, payments, receivables,
    closures, containers: [received, inTransit], containerItems, quotes, quoteItems,
    deliveryNotes, deliveryItems, alerts, listings,
  };
}

/** Drops the helper keys that are not columns. */
function columns(rows) {
  return rows.map(({ key: _k, sku_key: _s, store: _st, wholesale: _w, ...row }) => row);
}

// ── Supabase Admin API (auth user) ───────────────────────────────────────
async function authAdmin(method, path, body) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  const res = await fetch(`${url}/auth/v1/admin/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`auth admin ${method} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────
const preview = buildDataset("00000000-0000-0000-0000-000000000000");
const summary = Object.fromEntries(
  Object.entries(preview)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => [k, v.length]),
);
console.log(`Demo workspace "${DEMO.workspace.name}" (${DEMO.workspace.slug}), owner ${DEMO.owner.username}`);
console.log(JSON.stringify(summary));
if (DRY_RUN) {
  console.log("[dry-run] Nothing written.");
  process.exit(0);
}

const db = await connect();

const {
  rows: [existing],
} = await db.query("select id from workspace where slug = $1", [DEMO.workspace.slug]);
if (existing) {
  console.error(`Workspace ${DEMO.workspace.slug} already exists (${existing.id}). Run unseed-demo-workspace.mjs first.`);
  await db.end();
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const authUser = await authAdmin("POST", "users", {
  email: DEMO.owner.email,
  password,
  email_confirm: true,
  user_metadata: { full_name: DEMO.owner.fullName },
});
const ownerId = authUser.id;
const data = buildDataset(ownerId);
const orgRif = rif("J", DEMO.organization.rifDigits);

try {
  await transaction(db, async () => {
    await insert(db, "organization", { id: data.organizationId, name: DEMO.organization.name, legal_name: DEMO.organization.legalName, rif: orgRif, currency: "USD", timezone: "America/Caracas" });
    await insert(db, "workspace", { id: data.workspaceId, organization_id: data.organizationId, name: DEMO.workspace.name, slug: DEMO.workspace.slug, plan: "enterprise", status: "active", created_by: ownerId });
    await insert(db, "workspace_quota", { workspace_id: data.workspaceId, max_users: 25, max_products: 100000, max_customers: 100000, max_warehouses: 50, max_storage_mb: 51200 });
    await insert(db, "workspace_module", ERP_MODULES.map((module) => ({ workspace_id: data.workspaceId, module, enabled_by: ownerId })));
    await insert(db, "workspace_profile", { workspace_id: data.workspaceId, display_name: DEMO.workspace.name, legal_name: DEMO.organization.legalName, tax_id: orgRif, address_line: DEMO.profile.address, city: DEMO.profile.city, state: DEMO.profile.state, country: DEMO.profile.country, phone: DEMO.profile.phone, support_email: DEMO.profile.supportEmail, base_currency: "USD" });
    await insert(db, "user_profile", { id: ownerId, email: DEMO.owner.email, full_name: DEMO.owner.fullName, role: "owner", status: "active", organization_id: data.organizationId, username: DEMO.owner.username, default_workspace_id: data.workspaceId });
    await insert(db, "workspace_member", { workspace_id: data.workspaceId, user_id: ownerId, role: "owner", status: "active", joined_at: daysAgo(60) });

    await insert(db, "warehouse", columns(data.warehouses));
    await insert(db, "category", columns(data.categories));
    await insert(db, "brand", data.brands);
    await insert(db, "supplier", columns(data.suppliers));
    await insert(db, "product", columns(data.products));
    await insert(db, "product_price", data.prices);
    await insert(db, "stock_ledger", data.ledger);
    await insert(db, "stock_movement", data.movements);
    await insert(db, "customer", data.customers);
    await insert(db, "exchange_rate", data.rates);
    // order_number is generated by trg_order_number (OC-<seq>).
    await insert(db, "sales_order", data.orders);
    await insert(db, "order_item", data.items);
    // Receivables before payments: trg_ar_payment applies each payment.
    await insert(db, "account_receivable", data.receivables);
    await insert(db, "payment", data.payments);
    await insert(db, "cash_closure", data.closures);
    await insert(db, "container", data.containers);
    await insert(db, "container_item", data.containerItems);
    await insert(db, "quote", data.quotes);
    await insert(db, "quote_item", data.quoteItems);
    await insert(db, "delivery_note", data.deliveryNotes);
    await insert(db, "delivery_note_item", data.deliveryItems);
    await insert(db, "system_alert", data.alerts);
    await insert(db, "ml_listing", data.listings);
    // Customer balances = open receivables (after the payment trigger ran).
    await db.query(
      `update customer c set balance = ar.open
       from (select customer_id, sum(balance) as open from account_receivable
             where workspace_id = $1 group by customer_id) ar
       where c.id = ar.customer_id and c.workspace_id = $1`,
      [data.workspaceId],
    );
  });
} catch (error) {
  console.error("Seed failed; removing the auth user created for it.");
  await authAdmin("DELETE", `users/${ownerId}`).catch((e) => console.error(String(e)));
  await db.end();
  throw error;
}

writeFileSync(
  CREDENTIALS_FILE,
  [
    "# Demo account for landing recordings (scripts/landing-media). Git-ignored.",
    `LANDING_DEMO_USERNAME=${DEMO.owner.username}`,
    `LANDING_DEMO_PASSWORD=${password}`,
    `LANDING_DEMO_WORKSPACE_ID=${data.workspaceId}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

await db.end();
console.log(`Done. Workspace ${data.workspaceId}. Credentials written to .env.landing-demo (not printed).`);
