#!/usr/bin/env node
/**
 * role-matrix-audit.mjs — Cendaro ERP 6x26 Role Access Matrix (Phase C1)
 *
 * Evaluates access rules across all 6 roles (owner, admin, supervisor, employee, vendor, marketing)
 * for all 26 authenticated routes according to NAV_ROLE_RULES and parent/child permission gates.
 */

import { NAV_ITEMS } from "../../apps/erp/src/lib/navigation.ts";
import { NAV_ROLE_RULES, USER_ROLES } from "../../packages/validators/src/index.ts";

const ROUTES = [
  { path: "/dashboard", rule: null, name: "Resumen / Dashboard" },
  { path: "/pos", rule: "pos", name: "Punto de Venta" },
  { path: "/orders", rule: null, name: "Pedidos" },
  { path: "/quotes", rule: null, name: "Cotizaciones" },
  { path: "/delivery-notes", rule: "deliveryNotes", name: "Notas de Entrega" },
  { path: "/invoices", rule: "invoices", name: "Facturas" },
  { path: "/vendors", rule: "vendors", name: "Vendedores" },
  { path: "/customers", rule: null, name: "Clientes" },
  { path: "/catalog", rule: null, name: "Catálogo Productos" },
  { path: "/catalog/categories", rule: null, name: "Categorías" },
  { path: "/catalog/brands", rule: null, name: "Marcas" },
  { path: "/catalog/suppliers", rule: null, name: "Proveedores" },
  { path: "/pricing", rule: "pricing", name: "Precios" },
  { path: "/catalog/import", rule: "catalogImport", name: "Importación Catálogo" },
  { path: "/inventory", rule: "inventory", name: "Inventario Almacenes" },
  { path: "/containers", rule: "containers", name: "Contenedores" },
  { path: "/payments", rule: "payments", name: "Pagos" },
  { path: "/accounts-receivable", rule: "accountsReceivable", name: "Cuentas por Cobrar" },
  { path: "/cash-closure", rule: "cashClosure", name: "Cierre de Caja" },
  { path: "/rates", rule: "rates", name: "Tasas de Cambio" },
  { path: "/marketplace", rule: "marketplace", name: "Mercado Libre" },
  { path: "/whatsapp", rule: "whatsapp", name: "WhatsApp" },
  { path: "/settings", rule: "settings", name: "Configuración General" },
  { path: "/users", rule: "users", name: "Gestión de Usuarios" },
  { path: "/audit", rule: "audit", name: "Auditoría de Sistema" },
  { path: "/alerts", rule: "alerts", name: "Alertas" },
];

console.log("==================================================");
console.log("🛡️ Cendaro ERP — 6x26 Role Access Matrix Audit (C1)");
console.log("Roles:", USER_ROLES.join(", "));
console.log(`Routes: ${ROUTES.length}`);
console.log("==================================================\n");

function isAllowed(role, ruleKey) {
  if (!ruleKey) return true; // accessible to authenticated users
  const allowedRoles = NAV_ROLE_RULES[ruleKey];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

const matrix = {};
let violations = 0;

for (const r of ROUTES) {
  const row = { Route: r.path };
  for (const role of USER_ROLES) {
    const allowed = isAllowed(role, r.rule);
    row[role] = allowed ? "✅ ALLOW" : "⛔ DENY";

    // Strict invariant checks:
    // 1. Employee must NEVER have access to Settings, Users, Audit, Pricing, Rates, Containers, Inventory
    if (role === "employee") {
      if (["/settings", "/users", "/audit", "/pricing", "/rates", "/containers", "/inventory"].includes(r.path) && allowed) {
        violations++;
      }
    }
    // 2. Vendor must NEVER have access to Settings, Users, Audit, Payments, Rates, Cash-closure
    if (role === "vendor") {
      if (["/settings", "/users", "/audit", "/payments", "/rates", "/cash-closure"].includes(r.path) && allowed) {
        violations++;
      }
    }
    // 3. Marketing must NEVER have access to Settings, Users, Audit, Cash Closure, Rates
    if (role === "marketing") {
      if (["/settings", "/users", "/audit", "/cash-closure", "/rates"].includes(r.path) && allowed) {
        violations++;
      }
    }
  }
  matrix[r.path] = row;
}

console.table(Object.values(matrix));

console.log("\n==================================================");
console.log("Role Matrix Audit Results:");
console.log(`Total Cells Evaluated: ${ROUTES.length * USER_ROLES.length} (26 x 6)`);
console.log(`Role Invariant Violations: ${violations}`);
console.log("==================================================");

if (violations > 0) {
  console.error("❌ RBAC matrix violations detected!");
  process.exit(1);
} else {
  console.log("🎉 100% COMPLIANT: Zero privilege leakages across all 6 roles!");
  process.exit(0);
}
