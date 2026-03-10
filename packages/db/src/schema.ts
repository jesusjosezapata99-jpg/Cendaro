/**
 * Cendaro — Database Schema
 *
 * Phase 0: Foundation (audit_log, organization)
 * Phase 1: Identity, RBAC, permissions
 * Phase 2: Catalog (brand, category, supplier, product, attributes, prices)
 * Phase 3: Inventory + Containers (warehouse, stock, channels, movements, counts, containers)
 * Phase 4: Pricing Engine (exchange rates, price history, repricing events)
 * Phase 5: Sales, Payments & Cash (customer, orders, payments, cash closure)
 * Phase 6: Vendor Portal & AR (commissions, accounts receivable)
 * Phase 7: Integrations (Mercado Libre, WhatsApp, integration logs)
 * Phase 8: Dashboard & Alerts (executive KPIs, system alerts)
 *
 * Convention: All tables use snake_case via Drizzle `casing` option.
 * All IDs are UUIDv4. All timestamps are `timestamptz`.
 */
import { relations, sql } from "drizzle-orm";
import { index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";

// ╔══════════════════════════════════════════════╗
// ║ ENUMS                                       ║
// ╚══════════════════════════════════════════════╝

// --- Phase 1 enums ---

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "supervisor",
  "employee",
  "vendor",
  "marketing",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
]);

export const permissionActionEnum = pgEnum("permission_action", [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "export",
]);

export const erpModuleEnum = pgEnum("erp_module", [
  "dashboard",
  "catalog",
  "inventory",
  "containers",
  "pricing",
  "rates",
  "pos",
  "orders",
  "customers",
  "vendors",
  "payments",
  "cash_closure",
  "marketplace",
  "whatsapp",
  "users",
  "audit",
  "settings",
]);

// --- Phase 2 enums ---

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "draft",
  "discontinued",
]);

export const priceTypeEnum = pgEnum("price_type", [
  "store",       // precio tienda
  "wholesale",   // precio mayor
  "vendor",      // precio vendedor nacional
  "promo",       // precio promo online
  "special",     // precio especial manual
]);

export const supplierStatusEnum = pgEnum("supplier_status", [
  "active",
  "inactive",
]);

// --- Phase 3 enums ---

export const salesChannelEnum = pgEnum("sales_channel", [
  "store",          // tienda física
  "mercadolibre",   // Mercado Libre
  "vendors",        // vendedores nacionales (pool compartido)
  "whatsapp",       // WhatsApp (consumes store stock)
  "instagram",      // Instagram (consumes store stock)
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "purchase",         // entrada por compra/importación
  "sale",             // salida por venta
  "transfer",         // transferencia entre canales
  "adjustment_in",    // ajuste positivo
  "adjustment_out",   // ajuste negativo
  "return",           // devolución
  "container_receipt", // recepción de contenedor
  "count_adjustment", // ajuste por conteo cíclico
]);

export const containerStatusEnum = pgEnum("container_status", [
  "created",      // creado
  "in_transit",   // embarcado / en tránsito
  "received",     // recibido total
  "closed",       // cerrado
]);

export const countStatusEnum = pgEnum("count_status", [
  "draft",
  "in_progress",
  "completed",
  "approved",
]);

export const warehouseTypeEnum = pgEnum("warehouse_type", [
  "showroom",       // tienda / exhibición
  "warehouse",      // almacén principal
  "external",       // almacén externo
  "transit",        // stock en tránsito / standby
  "reserved",       // stock reservado / emergencia
  "defective",      // stock defectuoso
]);

// --- Phase 4 enums ---

export const rateTypeEnum = pgEnum("rate_type", [
  "bcv",        // tasa BCV oficial
  "parallel",   // tasa paralela interna
  "rmb_usd",    // RMB/CNY → USD
  "rmb_bs",     // RMB/CNY → Bs (derivada)
]);

export const repricingTriggerEnum = pgEnum("repricing_trigger", [
  "auto",       // disparado por variación ≥ 5%
  "manual",     // editado por admin/supervisor
  "scheduled",  // programado
]);

// --- Phase 5 enums ---

export const customerTypeEnum = pgEnum("customer_type", [
  "wholesale",     // mayorista
  "retail",        // detal
  "distributor",   // distribuidor
  "vip",           // VIP
  "marketplace",   // marketplace
  "vendor_client", // cliente de vendedor
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",       // pendiente
  "confirmed",     // confirmado
  "prepared",      // preparado
  "dispatched",    // despachado
  "delivered",     // entregado
  "cancelled",     // anulado
  "returned",      // devuelto
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "mobile_payment", // pago móvil
  "transfer",       // transferencia
  "cash",           // efectivo
  "pos_terminal",   // punto de venta
  "zelle",          // Zelle / similares
]);

export const closureStatusEnum = pgEnum("closure_status", [
  "open",
  "closed",
  "reviewed",
]);

// --- Phase 6 enums ---

export const arStatusEnum = pgEnum("ar_status", [
  "pending",    // pendiente
  "partial",    // abono parcial
  "paid",       // pagado completo
  "overdue",    // vencido
  "written_off",// castigado
]);

// --- Phase 7 enums ---

export const mlListingStatusEnum = pgEnum("ml_listing_status", [
  "active",     // publicado
  "paused",     // pausado
  "closed",     // cerrado
  "out_of_stock", // sin stock
  "error",      // error de sincronización
]);

export const integrationLogLevelEnum = pgEnum("integration_log_level", [
  "info",
  "warning",
  "error",
  "critical",
]);

// --- Phase 8 enums ---

export const alertTypeEnum = pgEnum("alert_type", [
  "low_stock",           // stock bajo
  "inventory_diff",      // diferencia de inventario
  "product_blocked",     // producto bloqueado por inconsistencia
  "rate_change",         // cambio de tasa / repricing pendiente
  "vendor_under_target", // vendedor bajo meta
  "order_late",          // pedido atrasado
  "ml_failure",          // falla de integración ML
  "ar_overdue",          // CxC vencidas
]);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 1 — Organization, Identity, RBAC      ║
// ╚══════════════════════════════════════════════╝

export const Organization = pgTable("organization", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.varchar({ length: 256 }).notNull(),
  legalName: t.varchar({ length: 512 }),
  rif: t.varchar({ length: 32 }),
  currency: t.varchar({ length: 3 }).notNull().default("USD"),
  timezone: t.varchar({ length: 64 }).notNull().default("America/Caracas"),
  createdAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const UserProfile = pgTable(
  "user_profile",
  (t) => ({
    id: t.uuid().notNull().primaryKey(),
    email: t.varchar({ length: 256 }).notNull(),
    fullName: t.varchar({ length: 256 }).notNull(),
    role: userRoleEnum().notNull().default("employee"),
    status: userStatusEnum().notNull().default("active"),
    phone: t.varchar({ length: 32 }),
    avatarUrl: t.text(),
    organizationId: t
      .uuid()
      .references(() => Organization.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
    lastLoginAt: t.timestamp({ mode: "date", withTimezone: true }),
  }),
  (table) => [
    index("idx_user_profile_role").on(table.role),
    index("idx_user_profile_status").on(table.status),
    index("idx_user_profile_email").on(table.email),
  ],
);

export const Permission = pgTable(
  "permission",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    module: erpModuleEnum().notNull(),
    action: permissionActionEnum().notNull(),
    description: t.varchar({ length: 512 }),
  }),
  (table) => [unique("uq_permission_module_action").on(table.module, table.action)],
);

export const RolePermission = pgTable(
  "role_permission",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    role: userRoleEnum().notNull(),
    permissionId: t
      .uuid()
      .notNull()
      .references(() => Permission.id, { onDelete: "cascade" }),
    grantedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    grantedBy: t.uuid(),
  }),
  (table) => [
    unique("uq_role_permission").on(table.role, table.permissionId),
    index("idx_role_permission_role").on(table.role),
  ],
);

export const AuditLog = pgTable(
  "audit_log",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    actorId: t.uuid(),
    actorRole: userRoleEnum(),
    actorName: t.varchar({ length: 256 }),
    action: t.varchar({ length: 128 }).notNull(),
    entity: t.varchar({ length: 64 }).notNull(),
    entityId: t.uuid(),
    oldValue: t.jsonb(),
    newValue: t.jsonb(),
    metadata: t.jsonb(),
    correlationId: t.uuid(),
    ipAddress: t.varchar({ length: 45 }),
    userAgent: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_audit_log_actor").on(table.actorId),
    index("idx_audit_log_entity").on(table.entity, table.entityId),
    index("idx_audit_log_created").on(table.createdAt),
    index("idx_audit_log_action").on(table.action),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 2 — Catalog Domain                    ║
// ╚══════════════════════════════════════════════╝

export const Brand = pgTable(
  "brand",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 256 }).notNull(),
    slug: t.varchar({ length: 256 }).notNull(),
    logoUrl: t.text(),
    description: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_brand_slug").on(table.slug),
    index("idx_brand_name").on(table.name),
  ],
);

export const Category = pgTable(
  "category",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 256 }).notNull(),
    slug: t.varchar({ length: 256 }).notNull(),
    parentId: t.uuid(),
    depth: t.integer().notNull().default(0),
    sortOrder: t.integer().notNull().default(0),
    attributesTemplate: t.jsonb(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_category_slug").on(table.slug),
    index("idx_category_parent").on(table.parentId),
  ],
);

export const Supplier = pgTable(
  "supplier",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 256 }).notNull(),
    rif: t.varchar({ length: 32 }),
    country: t.varchar({ length: 3 }).notNull().default("CN"),
    contactName: t.varchar({ length: 256 }),
    contactEmail: t.varchar({ length: 256 }),
    contactPhone: t.varchar({ length: 32 }),
    status: supplierStatusEnum().notNull().default("active"),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_supplier_name").on(table.name),
    index("idx_supplier_status").on(table.status),
  ],
);

export const Product = pgTable(
  "product",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    sku: t.varchar({ length: 64 }).notNull(),
    barcode: t.varchar({ length: 128 }),
    name: t.varchar({ length: 512 }).notNull(),
    descriptionShort: t.varchar({ length: 512 }),
    descriptionLong: t.text(),
    brandId: t
      .uuid()
      .references(() => Brand.id),
    categoryId: t
      .uuid()
      .references(() => Category.id),
    supplierId: t
      .uuid()
      .references(() => Supplier.id),
    imageUrl: t.text(),
    weight: t.doublePrecision(),
    volume: t.doublePrecision(),
    costAvg: t.numeric({ precision: 12, scale: 4 }).default("0"),
    status: productStatusEnum().notNull().default("draft"),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    unique("uq_product_sku").on(table.sku),
    index("idx_product_barcode").on(table.barcode),
    index("idx_product_brand").on(table.brandId),
    index("idx_product_category").on(table.categoryId),
    index("idx_product_supplier").on(table.supplierId),
    index("idx_product_status").on(table.status),
    index("idx_product_name").on(table.name),
  ],
);

export const ProductAttribute = pgTable(
  "product_attribute",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id, { onDelete: "cascade" }),
    key: t.varchar({ length: 128 }).notNull(),
    value: t.varchar({ length: 512 }).notNull(),
  }),
  (table) => [
    unique("uq_product_attr_key").on(table.productId, table.key),
    index("idx_product_attr_product").on(table.productId),
  ],
);

export const ProductPrice = pgTable(
  "product_price",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id, { onDelete: "cascade" }),
    priceType: priceTypeEnum().notNull(),
    amountUsd: t.doublePrecision().notNull(),
    amountBs: t.doublePrecision(),
    rateUsed: t.doublePrecision(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_product_price_type").on(table.productId, table.priceType),
    index("idx_product_price_product").on(table.productId),
    index("idx_product_price_type").on(table.priceType),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 3 — Inventory + Containers             ║
// ╚══════════════════════════════════════════════╝

export const Warehouse = pgTable(
  "warehouse",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 256 }).notNull(),
    type: warehouseTypeEnum().notNull(),
    location: t.varchar({ length: 512 }),
    isActive: t.boolean().notNull().default(true),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_warehouse_type").on(table.type),
  ],
);

export const StockLedger = pgTable(
  "stock_ledger",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    warehouseId: t
      .uuid()
      .notNull()
      .references(() => Warehouse.id),
    quantity: t.integer().notNull().default(0),
    isLocked: t.boolean().notNull().default(false),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_stock_product_warehouse").on(table.productId, table.warehouseId),
    index("idx_stock_product").on(table.productId),
    index("idx_stock_warehouse").on(table.warehouseId),
  ],
);

export const ChannelAllocation = pgTable(
  "channel_allocation",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    channel: salesChannelEnum().notNull(),
    quantity: t.integer().notNull().default(0),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_channel_product").on(table.productId, table.channel),
    index("idx_channel_product").on(table.productId),
    index("idx_channel_channel").on(table.channel),
  ],
);

export const StockMovement = pgTable(
  "stock_movement",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    movementType: movementTypeEnum().notNull(),
    quantity: t.integer().notNull(),
    fromChannel: salesChannelEnum(),
    toChannel: salesChannelEnum(),
    warehouseId: t.uuid().references(() => Warehouse.id),
    referenceId: t.uuid(),
    referenceType: t.varchar({ length: 64 }),
    notes: t.text(),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_movement_product").on(table.productId),
    index("idx_movement_type").on(table.movementType),
    index("idx_movement_created").on(table.createdAt),
  ],
);

export const InventoryCount = pgTable(
  "inventory_count",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    warehouseId: t
      .uuid()
      .notNull()
      .references(() => Warehouse.id),
    status: countStatusEnum().notNull().default("draft"),
    scheduledAt: t.timestamp({ mode: "date", withTimezone: true }),
    completedAt: t.timestamp({ mode: "date", withTimezone: true }),
    approvedBy: t.uuid(),
    notes: t.text(),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_count_warehouse").on(table.warehouseId),
    index("idx_count_status").on(table.status),
  ],
);

export const Container = pgTable(
  "container",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    containerNumber: t.varchar({ length: 64 }).notNull(),
    supplierId: t.uuid().references(() => Supplier.id),
    status: containerStatusEnum().notNull().default("created"),
    departureDate: t.timestamp({ mode: "date", withTimezone: true }),
    arrivalDate: t.timestamp({ mode: "date", withTimezone: true }),
    costFob: t.doublePrecision(),
    notes: t.text(),
    closedBy: t.uuid(),
    closedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    // Packing list AI processing
    packingListUrl: t.text(),
    packingListStatus: t.varchar({ length: 32 }).notNull().default("none"),
    packingListProcessedAt: t.timestamp({ mode: "date", withTimezone: true }),
    packingListItemCount: t.integer().notNull().default(0),
  }),
  (table) => [
    unique("uq_container_number").on(table.containerNumber),
    index("idx_container_status").on(table.status),
    index("idx_container_supplier").on(table.supplierId),
  ],
);

export const ContainerItem = pgTable(
  "container_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    containerId: t
      .uuid()
      .notNull()
      .references(() => Container.id, { onDelete: "cascade" }),
    productId: t
      .uuid()
      .references(() => Product.id),
    quantityExpected: t.integer().notNull(),
    quantityReceived: t.integer().default(0),
    unitCost: t.doublePrecision(),
    notes: t.text(),
    // AI-parsed packing list fields
    originalName: t.text(),
    translatedName: t.text(),
    weightKg: t.doublePrecision(),
    skuHint: t.varchar({ length: 128 }),
    categoryHint: t.varchar({ length: 256 }),
    isMatched: t.boolean().notNull().default(false),
    // AI confidence & matching
    confidence: t.doublePrecision(),
    suggestedProductId: t.uuid().references(() => Product.id),
    aiCorrected: t.boolean().notNull().default(false),
    // AI vision pipeline
    imageUrl: t.text(),
    imageDescription: t.text(),
  }),
  (table) => [
    index("idx_citem_container").on(table.containerId),
    index("idx_citem_product").on(table.productId),
  ],
);

// AI Prompt Configuration
export const AiPromptConfig = pgTable(
  "ai_prompt_config",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    configKey: t.varchar({ length: 64 }).notNull(),
    systemPrompt: t.text().notNull(),
    fewShotExamples: t.jsonb().notNull().default([]),
    businessContext: t.text(),
    categoryRules: t.text(),
    active: t.boolean().notNull().default(true),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_ai_prompt_config_key").on(table.configKey),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 4 — Pricing Engine                     ║
// ╚══════════════════════════════════════════════╝

export const ExchangeRate = pgTable(
  "exchange_rate",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    rateType: rateTypeEnum().notNull(),
    rate: t.doublePrecision().notNull(),
    source: t.varchar({ length: 128 }),
    notes: t.text(),
    updatedBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_rate_type").on(table.rateType),
    index("idx_rate_created").on(table.createdAt),
  ],
);

export const PriceHistory = pgTable(
  "price_history",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    priceType: priceTypeEnum().notNull(),
    oldAmountUsd: t.doublePrecision(),
    newAmountUsd: t.doublePrecision().notNull(),
    oldAmountBs: t.doublePrecision(),
    newAmountBs: t.doublePrecision(),
    rateUsed: t.doublePrecision(),
    trigger: repricingTriggerEnum().notNull(),
    userId: t.uuid(),
    repricingEventId: t.uuid(),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_ph_product").on(table.productId),
    index("idx_ph_created").on(table.createdAt),
    index("idx_ph_trigger").on(table.trigger),
  ],
);

export const RepricingEvent = pgTable(
  "repricing_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    trigger: repricingTriggerEnum().notNull(),
    rateType: rateTypeEnum(),
    oldRate: t.doublePrecision(),
    newRate: t.doublePrecision(),
    variationPct: t.doublePrecision(),
    productsAffected: t.integer().notNull().default(0),
    isApproved: t.boolean().default(false),
    approvedBy: t.uuid(),
    approvedAt: t.timestamp({ mode: "date", withTimezone: true }),
    expiresAt: t.timestamp({ mode: "date", withTimezone: true }),
    notes: t.text(),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_reprice_trigger").on(table.trigger),
    index("idx_reprice_approved").on(table.isApproved),
    index("idx_reprice_created").on(table.createdAt),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 5 — Sales, Payments & Cash             ║
// ╚══════════════════════════════════════════════╝

export const Customer = pgTable(
  "customer",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 256 }).notNull(),
    legalName: t.varchar({ length: 512 }),
    identification: t.varchar({ length: 32 }),
    customerType: customerTypeEnum().notNull().default("retail"),
    phone: t.varchar({ length: 32 }),
    phone2: t.varchar({ length: 32 }),
    email: t.varchar({ length: 256 }),
    address: t.text(),
    assignedVendorId: t.uuid().references(() => UserProfile.id),
    creditLimit: t.doublePrecision().default(0),
    creditDays: t.integer().default(0),
    balance: t.doublePrecision().default(0),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_customer_type").on(table.customerType),
    index("idx_customer_name").on(table.name),
    index("idx_customer_vendor").on(table.assignedVendorId),
  ],
);

export const SalesOrder = pgTable(
  "sales_order",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    orderNumber: t.varchar({ length: 32 }).notNull(),
    customerId: t.uuid().references(() => Customer.id),
    channel: salesChannelEnum().notNull().default("store"),
    status: orderStatusEnum().notNull().default("pending"),
    subtotal: t.doublePrecision().notNull().default(0),
    discount: t.doublePrecision().default(0),
    total: t.doublePrecision().notNull().default(0),
    totalPaid: t.doublePrecision().default(0),
    notes: t.text(),
    closedBy: t.uuid().references(() => UserProfile.id),
    createdBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    unique("uq_order_number").on(table.orderNumber),
    index("idx_order_customer").on(table.customerId),
    index("idx_order_channel").on(table.channel),
    index("idx_order_status").on(table.status),
    index("idx_order_created").on(table.createdAt),
  ],
);

export const OrderItem = pgTable(
  "order_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    orderId: t
      .uuid()
      .notNull()
      .references(() => SalesOrder.id, { onDelete: "cascade" }),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    quantity: t.integer().notNull(),
    unitPrice: t.doublePrecision().notNull(),
    discount: t.doublePrecision().default(0),
    lineTotal: t.doublePrecision().notNull(),
  }),
  (table) => [
    index("idx_oitem_order").on(table.orderId),
    index("idx_oitem_product").on(table.productId),
  ],
);

export const Payment = pgTable(
  "payment",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    orderId: t
      .uuid()
      .notNull()
      .references(() => SalesOrder.id),
    method: paymentMethodEnum().notNull(),
    amount: t.doublePrecision().notNull(),
    reference: t.varchar({ length: 128 }),
    bankName: t.varchar({ length: 128 }),
    payerName: t.varchar({ length: 256 }),
    payerIdDoc: t.varchar({ length: 32 }),
    evidenceUrl: t.text(),
    isValidated: t.boolean().default(false),
    validatedBy: t.uuid(),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_payment_order").on(table.orderId),
    index("idx_payment_method").on(table.method),
    index("idx_payment_created").on(table.createdAt),
  ],
);

export const CashClosure = pgTable(
  "cash_closure",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    closureDate: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
    status: closureStatusEnum().notNull().default("open"),
    totalSales: t.doublePrecision().default(0),
    totalCash: t.doublePrecision().default(0),
    totalDigital: t.doublePrecision().default(0),
    expectedTotal: t.doublePrecision().default(0),
    actualTotal: t.doublePrecision().default(0),
    discrepancy: t.doublePrecision().default(0),
    notes: t.text(),
    closedBy: t.uuid(),
    reviewedBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_closure_date").on(table.closureDate),
    index("idx_closure_status").on(table.status),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 6 — Vendor Portal & AR                 ║
// ╚══════════════════════════════════════════════╝

export const VendorCommission = pgTable(
  "vendor_commission",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    vendorId: t
      .uuid()
      .notNull()
      .references(() => UserProfile.id),
    orderId: t
      .uuid()
      .notNull()
      .references(() => SalesOrder.id),
    orderTotal: t.doublePrecision().notNull(),
    commissionPct: t.doublePrecision().notNull().default(0),
    commissionAmount: t.doublePrecision().notNull().default(0),
    isPaid: t.boolean().default(false),
    paidAt: t.timestamp({ mode: "date", withTimezone: true }),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_vc_vendor").on(table.vendorId),
    index("idx_vc_order").on(table.orderId),
    index("idx_vc_paid").on(table.isPaid),
  ],
);

export const AccountReceivable = pgTable(
  "account_receivable",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    customerId: t
      .uuid()
      .notNull()
      .references(() => Customer.id),
    orderId: t
      .uuid()
      .references(() => SalesOrder.id),
    totalAmount: t.doublePrecision().notNull(),
    paidAmount: t.doublePrecision().notNull().default(0),
    balance: t.doublePrecision().notNull(),
    status: arStatusEnum().notNull().default("pending"),
    dueDate: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
    notes: t.text(),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_ar_customer").on(table.customerId),
    index("idx_ar_status").on(table.status),
    index("idx_ar_due").on(table.dueDate),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 7 — Integrations (ML + WhatsApp)        ║
// ╚══════════════════════════════════════════════╝

export const MlListing = pgTable(
  "ml_listing",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    mlItemId: t.varchar({ length: 64 }).notNull(),
    title: t.varchar({ length: 512 }).notNull(),
    status: mlListingStatusEnum().notNull().default("active"),
    price: t.doublePrecision().notNull(),
    stockSynced: t.integer().default(0),
    permalink: t.text(),
    lastSyncAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_ml_item").on(table.mlItemId),
    index("idx_ml_product").on(table.productId),
    index("idx_ml_status").on(table.status),
  ],
);

export const MlOrder = pgTable(
  "ml_order",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    mlOrderId: t.varchar({ length: 64 }).notNull(),
    mlListingId: t.uuid().references(() => MlListing.id),
    salesOrderId: t.uuid().references(() => SalesOrder.id),
    buyerNickname: t.varchar({ length: 128 }),
    quantity: t.integer().notNull().default(1),
    unitPrice: t.doublePrecision().notNull(),
    shippingStatus: t.varchar({ length: 64 }),
    trackingNumber: t.varchar({ length: 128 }),
    isImported: t.boolean().default(false),
    importedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_ml_order").on(table.mlOrderId),
    index("idx_mlo_listing").on(table.mlListingId),
    index("idx_mlo_imported").on(table.isImported),
  ],
);

export const IntegrationLog = pgTable(
  "integration_log",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    source: t.varchar({ length: 32 }).notNull(),
    level: integrationLogLevelEnum().notNull().default("info"),
    message: t.text().notNull(),
    payload: t.text(),
    isResolved: t.boolean().default(false),
    resolvedBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_ilog_source").on(table.source),
    index("idx_ilog_level").on(table.level),
    index("idx_ilog_resolved").on(table.isResolved),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ PHASE 8 — Dashboard & Alerts                  ║
// ╚══════════════════════════════════════════════╝

export const SystemAlert = pgTable(
  "system_alert",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    alertType: alertTypeEnum().notNull(),
    title: t.varchar({ length: 256 }).notNull(),
    message: t.text().notNull(),
    severity: t.varchar({ length: 16 }).notNull().default("medium"),
    entityType: t.varchar({ length: 64 }),
    entityId: t.uuid(),
    isDismissed: t.boolean().default(false),
    dismissedBy: t.uuid(),
    dismissedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_alert_type").on(table.alertType),
    index("idx_alert_severity").on(table.severity),
    index("idx_alert_dismissed").on(table.isDismissed),
    index("idx_alert_created").on(table.createdAt),
  ],
);

// ╔══════════════════════════════════════════════╗
// ║ RELATIONS                                    ║
// ╚══════════════════════════════════════════════╝

export const userProfileRelations = relations(UserProfile, ({ one }) => ({
  organization: one(Organization, {
    fields: [UserProfile.organizationId],
    references: [Organization.id],
  }),
}));

export const rolePermissionRelations = relations(RolePermission, ({ one }) => ({
  permission: one(Permission, {
    fields: [RolePermission.permissionId],
    references: [Permission.id],
  }),
}));

export const categoryRelations = relations(Category, ({ one, many }) => ({
  parent: one(Category, {
    fields: [Category.parentId],
    references: [Category.id],
    relationName: "categoryTree",
  }),
  children: many(Category, { relationName: "categoryTree" }),
  products: many(Product),
}));

export const brandRelations = relations(Brand, ({ many }) => ({
  products: many(Product),
}));

export const supplierRelations = relations(Supplier, ({ many }) => ({
  products: many(Product),
}));

export const productRelations = relations(Product, ({ one, many }) => ({
  brand: one(Brand, {
    fields: [Product.brandId],
    references: [Brand.id],
  }),
  category: one(Category, {
    fields: [Product.categoryId],
    references: [Category.id],
  }),
  supplier: one(Supplier, {
    fields: [Product.supplierId],
    references: [Supplier.id],
  }),
  attributes: many(ProductAttribute),
  prices: many(ProductPrice),
}));

export const productAttributeRelations = relations(ProductAttribute, ({ one }) => ({
  product: one(Product, {
    fields: [ProductAttribute.productId],
    references: [Product.id],
  }),
}));

export const productPriceRelations = relations(ProductPrice, ({ one }) => ({
  product: one(Product, {
    fields: [ProductPrice.productId],
    references: [Product.id],
  }),
}));

// --- Phase 3 relations ---

export const stockLedgerRelations = relations(StockLedger, ({ one }) => ({
  product: one(Product, {
    fields: [StockLedger.productId],
    references: [Product.id],
  }),
  warehouse: one(Warehouse, {
    fields: [StockLedger.warehouseId],
    references: [Warehouse.id],
  }),
}));

export const channelAllocationRelations = relations(ChannelAllocation, ({ one }) => ({
  product: one(Product, {
    fields: [ChannelAllocation.productId],
    references: [Product.id],
  }),
}));

export const stockMovementRelations = relations(StockMovement, ({ one }) => ({
  product: one(Product, {
    fields: [StockMovement.productId],
    references: [Product.id],
  }),
  warehouse: one(Warehouse, {
    fields: [StockMovement.warehouseId],
    references: [Warehouse.id],
  }),
}));

export const containerRelations = relations(Container, ({ one, many }) => ({
  supplier: one(Supplier, {
    fields: [Container.supplierId],
    references: [Supplier.id],
  }),
  items: many(ContainerItem),
}));

export const containerItemRelations = relations(ContainerItem, ({ one }) => ({
  container: one(Container, {
    fields: [ContainerItem.containerId],
    references: [Container.id],
  }),
  product: one(Product, {
    fields: [ContainerItem.productId],
    references: [Product.id],
  }),
}));

// --- Phase 4 relations ---

export const priceHistoryRelations = relations(PriceHistory, ({ one }) => ({
  product: one(Product, {
    fields: [PriceHistory.productId],
    references: [Product.id],
  }),
}));

// --- Phase 5 relations ---

export const customerRelations = relations(Customer, ({ one, many }) => ({
  assignedVendor: one(UserProfile, {
    fields: [Customer.assignedVendorId],
    references: [UserProfile.id],
  }),
  orders: many(SalesOrder),
}));

export const salesOrderRelations = relations(SalesOrder, ({ one, many }) => ({
  customer: one(Customer, {
    fields: [SalesOrder.customerId],
    references: [Customer.id],
  }),
  items: many(OrderItem),
  payments: many(Payment),
}));

export const orderItemRelations = relations(OrderItem, ({ one }) => ({
  order: one(SalesOrder, {
    fields: [OrderItem.orderId],
    references: [SalesOrder.id],
  }),
  product: one(Product, {
    fields: [OrderItem.productId],
    references: [Product.id],
  }),
}));

export const paymentRelations = relations(Payment, ({ one }) => ({
  order: one(SalesOrder, {
    fields: [Payment.orderId],
    references: [SalesOrder.id],
  }),
}));

// --- Phase 6 relations ---

export const vendorCommissionRelations = relations(VendorCommission, ({ one }) => ({
  vendor: one(UserProfile, {
    fields: [VendorCommission.vendorId],
    references: [UserProfile.id],
  }),
  order: one(SalesOrder, {
    fields: [VendorCommission.orderId],
    references: [SalesOrder.id],
  }),
}));

export const accountReceivableRelations = relations(AccountReceivable, ({ one }) => ({
  customer: one(Customer, {
    fields: [AccountReceivable.customerId],
    references: [Customer.id],
  }),
  order: one(SalesOrder, {
    fields: [AccountReceivable.orderId],
    references: [SalesOrder.id],
  }),
}));

// --- Phase 7 relations ---

export const mlListingRelations = relations(MlListing, ({ one, many }) => ({
  product: one(Product, {
    fields: [MlListing.productId],
    references: [Product.id],
  }),
  orders: many(MlOrder),
}));

export const mlOrderRelations = relations(MlOrder, ({ one }) => ({
  listing: one(MlListing, {
    fields: [MlOrder.mlListingId],
    references: [MlListing.id],
  }),
  salesOrder: one(SalesOrder, {
    fields: [MlOrder.salesOrderId],
    references: [SalesOrder.id],
  }),
}));
