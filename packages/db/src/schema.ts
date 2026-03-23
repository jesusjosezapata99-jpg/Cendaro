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
import {
  index,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  unique,
} from "drizzle-orm/pg-core";

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
  "store", // precio tienda
  "wholesale", // precio mayor
  "vendor", // precio vendedor nacional
  "promo", // precio promo online
  "special", // precio especial manual
]);

export const supplierStatusEnum = pgEnum("supplier_status", [
  "active",
  "inactive",
]);

// --- Catalog Import enums ---

export const importSessionStatusEnum = pgEnum("import_session_status", [
  "pending",
  "validating",
  "category_mapping",
  "dry_run",
  "committed",
  "failed",
  "expired",
]);

export const importSessionRowStatusEnum = pgEnum("import_session_row_status", [
  "pending",
  "valid",
  "warning",
  "error",
  "committed",
  "skipped",
  "failed",
]);

export const importSessionRowActionEnum = pgEnum("import_session_row_action", [
  "insert",
  "update",
  "skip",
]);

// --- Phase 3 enums ---

export const salesChannelEnum = pgEnum("sales_channel", [
  "store", // tienda física
  "mercadolibre", // Mercado Libre
  "vendors", // vendedores nacionales (pool compartido)
  "whatsapp", // WhatsApp (consumes store stock)
  "instagram", // Instagram (consumes store stock)
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "purchase", // entrada por compra/importación
  "sale", // salida por venta
  "transfer", // transferencia entre canales
  "adjustment_in", // ajuste positivo
  "adjustment_out", // ajuste negativo
  "return", // devolución
  "container_receipt", // recepción de contenedor
  "count_adjustment", // ajuste por conteo cíclico
  "initial_stock", // stock inicial al crear producto
]);

export const containerStatusEnum = pgEnum("container_status", [
  "created", // creado
  "in_transit", // embarcado / en tránsito
  "received", // recibido total
  "closed", // cerrado
]);

export const countStatusEnum = pgEnum("count_status", [
  "draft",
  "in_progress",
  "completed",
  "approved",
]);

export const warehouseTypeEnum = pgEnum("warehouse_type", [
  "showroom", // tienda / exhibición
  "warehouse", // almacén principal
  "external", // almacén externo
  "transit", // stock en tránsito / standby
  "reserved", // stock reservado / emergencia
  "defective", // stock defectuoso
]);

// --- Phase 4 enums ---

export const rateTypeEnum = pgEnum("rate_type", [
  "bcv", // tasa BCV oficial
  "parallel", // tasa paralela interna
  "rmb_usd", // RMB/CNY → USD
  "rmb_bs", // RMB/CNY → Bs (derivada)
]);

export const repricingTriggerEnum = pgEnum("repricing_trigger", [
  "auto", // disparado por variación ≥ 5%
  "manual", // editado por admin/supervisor
  "scheduled", // programado
]);

// --- Phase 5 enums ---

export const customerTypeEnum = pgEnum("customer_type", [
  "wholesale", // mayorista
  "retail", // detal
  "distributor", // distribuidor
  "vip", // VIP
  "marketplace", // marketplace
  "vendor_client", // cliente de vendedor
]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft", // borrador
  "pending", // pendiente
  "pending_confirmation", // pendiente de confirmación
  "confirmed", // confirmado
  "prepared", // preparado
  "dispatched", // despachado
  "delivered", // entregado
  "invoiced", // facturado
  "cancelled", // anulado
  "returned", // devuelto
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "mobile_payment", // pago móvil
  "transfer", // transferencia
  "cash", // efectivo
  "pos_terminal", // punto de venta
  "zelle", // Zelle / similares
]);

export const closureStatusEnum = pgEnum("closure_status", [
  "open",
  "closed",
  "reviewed",
]);

// --- Phase 6 enums ---

export const arStatusEnum = pgEnum("ar_status", [
  "pending", // pendiente
  "partial", // abono parcial
  "paid", // pagado completo
  "overdue", // vencido
  "written_off", // castigado
]);

// --- Phase 7 enums ---

export const mlListingStatusEnum = pgEnum("ml_listing_status", [
  "active", // publicado
  "paused", // pausado
  "closed", // cerrado
  "out_of_stock", // sin stock
  "error", // error de sincronización
]);

export const integrationLogLevelEnum = pgEnum("integration_log_level", [
  "info",
  "warning",
  "error",
  "critical",
]);

// --- Phase 8 enums ---

export const alertTypeEnum = pgEnum("alert_type", [
  "low_stock", // stock bajo
  "inventory_diff", // diferencia de inventario
  "product_blocked", // producto bloqueado por inconsistencia
  "rate_change", // cambio de tasa / repricing pendiente
  "vendor_under_target", // vendedor bajo meta
  "order_late", // pedido atrasado
  "ml_failure", // falla de integración ML
  "ar_overdue", // CxC vencidas
]);

// --- Phase 9 enums (Approvals & Signatures) ---

export const approvalTypeEnum = pgEnum("approval_type", [
  "credit_sale", // venta a crédito
  "inventory_adjustment", // ajuste de inventario
  "channel_stock_move", // movimiento entre canales
  "product_unblock", // desbloqueo de producto
  "price_change", // cambio de precio / repricing
  "container_close", // cierre de contenedor
  "cash_closure", // cierre de caja
  "edit_post_issue_document", // edición de doc post-emisión
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending", // pendiente de aprobación
  "approved", // aprobado
  "rejected", // rechazado
  "expired", // expirado
]);

// --- Multi-tenancy enums ---

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "suspended",
  "archived",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "invited",
  "suspended",
  "removed",
]);

export const workspacePlanEnum = pgEnum("workspace_plan", [
  "starter",
  "pro",
  "enterprise",
]);

export const notificationBucketTypeEnum = pgEnum("notification_bucket_type", [
  "finance",
  "operations",
  "inventory",
  "sales",
  "integrations",
  "general",
]);

// --- Sprint 2 enums (Commercial Flow) ---

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft", // borrador
  "sent", // enviada al cliente
  "accepted", // aceptada → se convierte en orden
  "rejected", // rechazada por el cliente
  "expired", // expirada
  "converted", // convertida en orden
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft", // borrador
  "issued", // emitido
  "cancelled", // anulado
]);

export const installmentStatusEnum = pgEnum("installment_status", [
  "pending", // pendiente
  "paid", // pagado
  "overdue", // vencido
  "partially_paid", // parcialmente pagado
]);

// ╔══════════════════════════════════════════════╗
// ║ RLS INFRASTRUCTURE                           ║
// ╚══════════════════════════════════════════════╝

/** DB role without BYPASSRLS — created via migration, referenced here for policies. */
export const appUserRole = pgRole("app_user").existing();

/** One-liner factory: adds workspace isolation RLS to any table with workspace_id. */
export const workspacePolicy = (tableName: string) =>
  pgPolicy(`${tableName}_workspace_isolation`, {
    as: "restrictive",
    for: "all",
    to: appUserRole,
    using: sql`workspace_id = current_setting('app.workspace_id', true)::uuid`,
    withCheck: sql`workspace_id = current_setting('app.workspace_id', true)::uuid`,
  });

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
    username: t.varchar({ length: 128 }).notNull(),
    avatarUrl: t.text(),
    organizationId: t.uuid().references(() => Organization.id),
    defaultWorkspaceId: t.uuid(), // FK added after Workspace table is defined
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
  (table) => [
    unique("uq_permission_module_action").on(table.module, table.action),
  ],
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
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("audit_log"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ MULTI-TENANCY — Workspace Infrastructure    ║
// ╚══════════════════════════════════════════════╝

export const Workspace = pgTable(
  "workspace",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    organizationId: t.uuid().references(() => Organization.id),
    name: t.varchar({ length: 256 }).notNull(),
    slug: t.varchar({ length: 128 }).notNull(),
    plan: workspacePlanEnum().notNull().default("starter"),
    status: workspaceStatusEnum().notNull().default("active"),
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
    unique("uq_workspace_slug").on(table.slug),
    index("idx_workspace_org").on(table.organizationId),
    index("idx_workspace_status").on(table.status),
    index("idx_workspace_plan").on(table.plan),
  ],
);

export const WorkspaceMember = pgTable(
  "workspace_member",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    userId: t
      .uuid()
      .notNull()
      .references(() => UserProfile.id, { onDelete: "cascade" }),
    role: userRoleEnum().notNull().default("employee"),
    status: memberStatusEnum().notNull().default("active"),
    invitedBy: t.uuid().references(() => UserProfile.id),
    joinedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_workspace_member").on(table.workspaceId, table.userId),
    index("idx_wm_workspace").on(table.workspaceId),
    index("idx_wm_user").on(table.userId),
    workspacePolicy("workspace_member"),
  ],
).enableRLS();

export const WorkspaceModule = pgTable(
  "workspace_module",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    module: erpModuleEnum().notNull(),
    enabledAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    enabledBy: t.uuid().references(() => UserProfile.id),
  }),
  (table) => [
    unique("uq_workspace_module").on(table.workspaceId, table.module),
    index("idx_wsm_workspace").on(table.workspaceId),
    workspacePolicy("workspace_module"),
  ],
).enableRLS();

export const WorkspaceQuota = pgTable(
  "workspace_quota",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    maxUsers: t.integer().notNull().default(1),
    maxProducts: t.integer().notNull().default(500),
    maxCustomers: t.integer().notNull().default(50),
    maxWarehouses: t.integer().notNull().default(1),
    maxStorageMb: t.integer().notNull().default(500),
    maxUsersPerRole: t.jsonb().notNull().default({}),
  }),
  (table) => [
    unique("uq_workspace_quota_ws").on(table.workspaceId),
    workspacePolicy("workspace_quota"),
  ],
).enableRLS();

export const WorkspaceProfile = pgTable(
  "workspace_profile",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    displayName: t.varchar({ length: 256 }),
    legalName: t.varchar({ length: 512 }),
    taxId: t.varchar({ length: 64 }),
    logoUrl: t.text(),
    addressLine: t.text(),
    city: t.varchar({ length: 128 }),
    state: t.varchar({ length: 128 }),
    country: t.varchar({ length: 64 }).default("VE"),
    phone: t.varchar({ length: 32 }),
    supportEmail: t.varchar({ length: 256 }),
    baseCurrency: t.varchar({ length: 3 }).notNull().default("USD"),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    unique("uq_workspace_profile_ws").on(table.workspaceId),
    workspacePolicy("workspace_profile"),
  ],
).enableRLS();

export const DocumentSequence = pgTable(
  "document_sequence",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    documentType: t.varchar({ length: 32 }).notNull(),
    lastNumber: t.integer().notNull().default(0),
  }),
  (table) => [
    unique("uq_doc_seq_ws_type").on(table.workspaceId, table.documentType),
    workspacePolicy("document_sequence"),
  ],
).enableRLS();

export const NotificationBucket = pgTable(
  "notification_bucket",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    bucket: notificationBucketTypeEnum().notNull(),
    label: t.varchar({ length: 128 }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_notification_bucket").on(table.workspaceId, table.bucket),
    workspacePolicy("notification_bucket"),
  ],
).enableRLS();

export const NotificationBucketAssignee = pgTable(
  "notification_bucket_assignee",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    bucketId: t
      .uuid()
      .notNull()
      .references(() => NotificationBucket.id, { onDelete: "cascade" }),
    memberId: t
      .uuid()
      .notNull()
      .references(() => WorkspaceMember.id, { onDelete: "cascade" }),
  }),
  (table) => [
    unique("uq_nba_bucket_member").on(table.bucketId, table.memberId),
    workspacePolicy("notification_bucket_assignee"),
  ],
).enableRLS();

export const NotificationRoutingRule = pgTable(
  "notification_routing_rule",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.workspace_id')::uuid`),
    alertType: alertTypeEnum().notNull(),
    bucketId: t
      .uuid()
      .notNull()
      .references(() => NotificationBucket.id, { onDelete: "cascade" }),
    isActive: t.boolean().notNull().default(true),
  }),
  (table) => [
    unique("uq_nrr_workspace_alert").on(table.workspaceId, table.alertType),
    workspacePolicy("notification_routing_rule"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 2 — Catalog Domain                    ║
// ╚══════════════════════════════════════════════╝

export const Brand = pgTable(
  "brand",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_brand_slug").on(table.workspaceId, table.slug),
    index("idx_brand_name").on(table.name),

    workspacePolicy("brand"),
  ],
).enableRLS();

export const Category = pgTable(
  "category",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_category_slug").on(table.workspaceId, table.slug),
    index("idx_category_parent").on(table.parentId),

    workspacePolicy("category"),
  ],
).enableRLS();

export const Supplier = pgTable(
  "supplier",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("supplier"),
  ],
).enableRLS();

export const Product = pgTable(
  "product",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    sku: t.varchar({ length: 64 }).notNull(),
    barcode: t.varchar({ length: 128 }),
    name: t.varchar({ length: 512 }).notNull(),
    descriptionShort: t.varchar({ length: 512 }),
    descriptionLong: t.text(),
    brandId: t.uuid().references(() => Brand.id),
    categoryId: t.uuid().references(() => Category.id),
    supplierId: t.uuid().references(() => Supplier.id),
    imageUrl: t.text(),
    weight: t.doublePrecision(),
    volume: t.doublePrecision(),
    baseUom: t.varchar({ length: 32 }).notNull().default("unit"),
    unitsPerBox: t.integer(),
    boxesPerBulk: t.integer(),
    presentationQty: t.integer().notNull().default(1),
    sellingUnit: t.varchar({ length: 32 }).notNull().default("unit"),
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
    unique("uq_product_sku").on(table.workspaceId, table.sku),
    index("idx_product_barcode").on(table.barcode),
    index("idx_product_brand").on(table.brandId),
    index("idx_product_category").on(table.categoryId),
    index("idx_product_supplier").on(table.supplierId),
    index("idx_product_status").on(table.status),
    index("idx_product_name").on(table.name),

    workspacePolicy("product"),
  ],
).enableRLS();

export const ProductAttribute = pgTable(
  "product_attribute",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id, { onDelete: "cascade" }),
    key: t.varchar({ length: 128 }).notNull(),
    value: t.varchar({ length: 512 }).notNull(),
  }),
  (table) => [
    unique("uq_product_attr_key").on(
      table.workspaceId,
      table.productId,
      table.key,
    ),
    index("idx_product_attr_product").on(table.productId),

    workspacePolicy("product_attribute"),
  ],
).enableRLS();

export const ProductUomEquivalence = pgTable(
  "product_uom_equivalence",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id, { onDelete: "cascade" }),
    baseUom: t.varchar({ length: 32 }).notNull().default("unit"),
    altUom: t.varchar({ length: 32 }).notNull(),
    conversionFactor: t.doublePrecision().notNull().default(1),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_puom_product").on(table.productId),
    workspacePolicy("product_uom_equivalence"),
  ],
).enableRLS();

export const ProductSupplier = pgTable(
  "product_supplier",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id, { onDelete: "cascade" }),
    supplierId: t
      .uuid()
      .notNull()
      .references(() => Supplier.id),
    supplierSku: t.varchar({ length: 128 }),
    cost: t.doublePrecision(),
    leadTimeDays: t.integer(),
    isPrimary: t.boolean().notNull().default(false),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_product_supplier").on(
      table.workspaceId,
      table.productId,
      table.supplierId,
    ),
    index("idx_ps_product").on(table.productId),
    index("idx_ps_supplier").on(table.supplierId),

    workspacePolicy("product_supplier"),
  ],
).enableRLS();

export const ProductPrice = pgTable(
  "product_price",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_product_price_type").on(
      table.workspaceId,
      table.productId,
      table.priceType,
    ),
    index("idx_product_price_product").on(table.productId),
    index("idx_product_price_type").on(table.priceType),

    workspacePolicy("product_price"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ CATALOG IMPORT — Category Aliases & Sessions ║
// ╚══════════════════════════════════════════════╝

export const CategoryAlias = pgTable(
  "category_alias",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    alias: t.varchar({ length: 256 }).notNull(),
    categoryId: t
      .uuid()
      .notNull()
      .references(() => Category.id),
    createdBy: t.uuid(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_category_alias_alias").on(table.workspaceId, table.alias),
    index("idx_category_alias_alias").on(table.alias),

    workspacePolicy("category_alias"),
  ],
).enableRLS();

export const ImportSession = pgTable(
  "import_session",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    userId: t.uuid().notNull(),
    type: t.varchar({ length: 32 }).notNull().default("catalog"),
    status: importSessionStatusEnum().notNull().default("pending"),
    filename: t.varchar({ length: 256 }),
    fileHash: t.varchar({ length: 64 }),
    totalRows: t.integer().notNull().default(0),
    validRows: t.integer().notNull().default(0),
    errorRows: t.integer().notNull().default(0),
    inserted: t.integer().notNull().default(0),
    updated: t.integer().notNull().default(0),
    skipped: t.integer().notNull().default(0),
    failed: t.integer().notNull().default(0),
    idempotencyKey: t.uuid(),
    metadata: t.jsonb(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    committedAt: t.timestamp({ mode: "date", withTimezone: true }),
    expiresAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '24 hours'`),
  }),
  (table) => [
    unique("uq_import_session_idempotency").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("idx_import_session_user").on(table.userId),
    index("idx_import_session_status").on(table.status),

    workspacePolicy("import_session"),
  ],
).enableRLS();

export const ImportSessionRow = pgTable(
  "import_session_row",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    importSessionId: t
      .uuid()
      .notNull()
      .references(() => ImportSession.id, { onDelete: "cascade" }),
    rowIndex: t.integer().notNull(),
    status: importSessionRowStatusEnum().notNull().default("pending"),
    action: importSessionRowActionEnum(),
    rawData: t.jsonb().notNull(),
    normalizedData: t.jsonb(),
    resolvedCategoryId: t.uuid().references(() => Category.id),
    resolvedBrandId: t.uuid().references(() => Brand.id),
    resolvedProductId: t.uuid().references(() => Product.id),
    errors: t.jsonb(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_isr_session").on(table.importSessionId),
    index("idx_isr_status").on(table.status),

    workspacePolicy("import_session_row"),
  ],
).enableRLS();

// --- Catalog Import inferred types ---
export type CategoryAlias = typeof CategoryAlias.$inferSelect;
export type NewCategoryAlias = typeof CategoryAlias.$inferInsert;
export type ImportSession = typeof ImportSession.$inferSelect;
export type NewImportSession = typeof ImportSession.$inferInsert;
export type ImportSessionRow = typeof ImportSessionRow.$inferSelect;
export type NewImportSessionRow = typeof ImportSessionRow.$inferInsert;

// ╔══════════════════════════════════════════════╗
// ║ PHASE 3 — Inventory + Containers             ║
// ╚══════════════════════════════════════════════╝

export const Warehouse = pgTable(
  "warehouse",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    workspacePolicy("warehouse"),
  ],
).enableRLS();

export const WarehouseLocation = pgTable(
  "warehouse_location",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    warehouseId: t
      .uuid()
      .notNull()
      .references(() => Warehouse.id, { onDelete: "cascade" }),
    code: t.varchar({ length: 32 }).notNull(),
    description: t.varchar({ length: 256 }),
    isActive: t.boolean().notNull().default(true),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_wl_warehouse_code").on(
      table.workspaceId,
      table.warehouseId,
      table.code,
    ),
    index("idx_wl_warehouse").on(table.warehouseId),

    workspacePolicy("warehouse_location"),
  ],
).enableRLS();

export const StockLedger = pgTable(
  "stock_ledger",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_stock_product_warehouse").on(
      table.workspaceId,
      table.productId,
      table.warehouseId,
    ),
    index("idx_stock_product").on(table.productId),
    index("idx_stock_warehouse").on(table.warehouseId),

    workspacePolicy("stock_ledger"),
  ],
).enableRLS();

export const ChannelAllocation = pgTable(
  "channel_allocation",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_channel_product").on(
      table.workspaceId,
      table.productId,
      table.channel,
    ),
    index("idx_channel_product").on(table.productId),
    index("idx_channel_channel").on(table.channel),

    workspacePolicy("channel_allocation"),
  ],
).enableRLS();

export const StockMovement = pgTable(
  "stock_movement",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("stock_movement"),
  ],
).enableRLS();

export const InventoryCount = pgTable(
  "inventory_count",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("inventory_count"),
  ],
).enableRLS();

export const InventoryCountItem = pgTable(
  "inventory_count_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    countId: t
      .uuid()
      .notNull()
      .references(() => InventoryCount.id, { onDelete: "cascade" }),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    systemQty: t.integer().notNull().default(0),
    countedQty: t.integer(),
    difference: t.integer(),
    notes: t.text(),
  }),
  (table) => [
    index("idx_ici_count").on(table.countId),
    index("idx_ici_product").on(table.productId),

    workspacePolicy("inventory_count_item"),
  ],
).enableRLS();

export const InventoryDiscrepancy = pgTable(
  "inventory_discrepancy",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    countId: t
      .uuid()
      .notNull()
      .references(() => InventoryCount.id),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    systemQty: t.integer().notNull(),
    countedQty: t.integer().notNull(),
    difference: t.integer().notNull(),
    resolution: t.text(),
    resolvedBy: t.uuid().references(() => UserProfile.id),
    resolvedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_id_count").on(table.countId),
    index("idx_id_product").on(table.productId),

    workspacePolicy("inventory_discrepancy"),
  ],
).enableRLS();

export const Container = pgTable(
  "container",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_container_number").on(table.workspaceId, table.containerNumber),
    index("idx_container_status").on(table.status),
    index("idx_container_supplier").on(table.supplierId),

    workspacePolicy("container"),
  ],
).enableRLS();

export const ContainerItem = pgTable(
  "container_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    containerId: t
      .uuid()
      .notNull()
      .references(() => Container.id, { onDelete: "cascade" }),
    productId: t.uuid().references(() => Product.id),
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
    matchType: t.varchar({ length: 32 }),
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

    workspacePolicy("container_item"),
  ],
).enableRLS();

export const ContainerDocument = pgTable(
  "container_document",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    containerId: t
      .uuid()
      .notNull()
      .references(() => Container.id, { onDelete: "cascade" }),
    documentType: t.varchar({ length: 64 }).notNull(),
    fileUrl: t.text().notNull(),
    fileName: t.varchar({ length: 256 }),
    uploadedBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_cd_container").on(table.containerId),
    workspacePolicy("container_document"),
  ],
).enableRLS();

// AI Prompt Configuration
export const AiPromptConfig = pgTable(
  "ai_prompt_config",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_ai_prompt_config_key").on(table.workspaceId, table.configKey),
    workspacePolicy("ai_prompt_config"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 4 — Pricing Engine                     ║
// ╚══════════════════════════════════════════════╝

export const ExchangeRate = pgTable(
  "exchange_rate",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("exchange_rate"),
  ],
).enableRLS();

export const PriceHistory = pgTable(
  "price_history",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("price_history"),
  ],
).enableRLS();

export const PricingRule = pgTable(
  "pricing_rule",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    name: t.varchar({ length: 128 }).notNull(),
    ruleType: t.varchar({ length: 32 }).notNull(),
    conditions: t.jsonb().notNull().default({}),
    adjustments: t.jsonb().notNull().default({}),
    priority: t.integer().notNull().default(0),
    isActive: t.boolean().notNull().default(true),
    validFrom: t.timestamp({ mode: "date", withTimezone: true }),
    validUntil: t.timestamp({ mode: "date", withTimezone: true }),
    createdBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_pr_type").on(table.ruleType),
    index("idx_pr_active").on(table.isActive),

    workspacePolicy("pricing_rule"),
  ],
).enableRLS();

export const RepricingEvent = pgTable(
  "repricing_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("repricing_event"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 5 — Sales, Payments & Cash             ║
// ╚══════════════════════════════════════════════╝

export const Customer = pgTable(
  "customer",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("customer"),
  ],
).enableRLS();

export const CustomerAddress = pgTable(
  "customer_address",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    customerId: t
      .uuid()
      .notNull()
      .references(() => Customer.id, { onDelete: "cascade" }),
    label: t.varchar({ length: 64 }).notNull().default("principal"),
    addressLine: t.text().notNull(),
    city: t.varchar({ length: 128 }),
    state: t.varchar({ length: 128 }),
    zip: t.varchar({ length: 16 }),
    country: t.varchar({ length: 64 }).default("VE"),
    isDefault: t.boolean().notNull().default(false),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_ca_customer").on(table.customerId),
    workspacePolicy("customer_address"),
  ],
).enableRLS();

export const SalesOrder = pgTable(
  "sales_order",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    orderNumber: t.varchar({ length: 32 }).notNull(),
    customerId: t.uuid().references(() => Customer.id),
    channel: salesChannelEnum().notNull().default("store"),
    status: orderStatusEnum().notNull().default("pending"),
    subtotal: t.doublePrecision().notNull().default(0),
    discount: t.doublePrecision().default(0),
    total: t.doublePrecision().notNull().default(0),
    totalPaid: t.doublePrecision().default(0),
    notes: t.text(),
    stockDeducted: t.boolean().notNull().default(false),
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
    unique("uq_order_number").on(table.workspaceId, table.orderNumber),
    index("idx_order_customer").on(table.customerId),
    index("idx_order_channel").on(table.channel),
    index("idx_order_status").on(table.status),
    index("idx_order_created").on(table.createdAt),

    workspacePolicy("sales_order"),
  ],
).enableRLS();

export const OrderItem = pgTable(
  "order_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("order_item"),
  ],
).enableRLS();

export const Payment = pgTable(
  "payment",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("payment"),
  ],
).enableRLS();

export const PaymentEvidence = pgTable(
  "payment_evidence",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    paymentId: t
      .uuid()
      .notNull()
      .references(() => Payment.id, { onDelete: "cascade" }),
    evidenceUrl: t.text().notNull(),
    evidenceType: t.varchar({ length: 32 }).notNull().default("image"),
    uploadedBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_pe_payment").on(table.paymentId),
    workspacePolicy("payment_evidence"),
  ],
).enableRLS();

export const PaymentAllocation = pgTable(
  "payment_allocation",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    paymentId: t
      .uuid()
      .notNull()
      .references(() => Payment.id),
    receivableId: t
      .uuid()
      .notNull()
      .references(() => AccountReceivable.id),
    amount: t.doublePrecision().notNull(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_pa_payment").on(table.paymentId),
    index("idx_pa_receivable").on(table.receivableId),

    workspacePolicy("payment_allocation"),
  ],
).enableRLS();

export const CashClosure = pgTable(
  "cash_closure",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("cash_closure"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 5b — Quotes, Delivery Notes, Invoices  ║
// ╚══════════════════════════════════════════════╝

export const Quote = pgTable(
  "quote",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    quoteNumber: t.varchar({ length: 32 }).notNull(),
    customerId: t.uuid().references(() => Customer.id),
    status: quoteStatusEnum().notNull().default("draft"),
    channel: salesChannelEnum().notNull().default("store"),
    subtotal: t.doublePrecision().notNull().default(0),
    discount: t.doublePrecision().default(0),
    total: t.doublePrecision().notNull().default(0),
    validUntil: t.timestamp({ mode: "date", withTimezone: true }),
    convertedOrderId: t.uuid().references(() => SalesOrder.id),
    notes: t.text(),
    createdBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t.timestamp({ mode: "date", withTimezone: true }),
  }),
  (table) => [
    unique("uq_quote_number").on(table.workspaceId, table.quoteNumber),
    index("idx_quote_customer").on(table.customerId),
    index("idx_quote_status").on(table.status),

    workspacePolicy("quote"),
  ],
).enableRLS();

export const QuoteItem = pgTable(
  "quote_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    quoteId: t
      .uuid()
      .notNull()
      .references(() => Quote.id, { onDelete: "cascade" }),
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
    index("idx_qi_quote").on(table.quoteId),
    index("idx_qi_product").on(table.productId),

    workspacePolicy("quote_item"),
  ],
).enableRLS();

export const DeliveryNote = pgTable(
  "delivery_note",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    noteNumber: t.varchar({ length: 32 }).notNull(),
    orderId: t
      .uuid()
      .notNull()
      .references(() => SalesOrder.id),
    status: documentStatusEnum().notNull().default("draft"),
    deliveryAddress: t.text(),
    recipientName: t.varchar({ length: 256 }),
    recipientIdDoc: t.varchar({ length: 32 }),
    dispatchedAt: t.timestamp({ mode: "date", withTimezone: true }),
    deliveredAt: t.timestamp({ mode: "date", withTimezone: true }),
    notes: t.text(),
    createdBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_delivery_note_number").on(table.workspaceId, table.noteNumber),
    index("idx_dn_order").on(table.orderId),
    index("idx_dn_status").on(table.status),

    workspacePolicy("delivery_note"),
  ],
).enableRLS();

export const DeliveryNoteItem = pgTable(
  "delivery_note_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    deliveryNoteId: t
      .uuid()
      .notNull()
      .references(() => DeliveryNote.id, { onDelete: "cascade" }),
    productId: t
      .uuid()
      .notNull()
      .references(() => Product.id),
    quantityDispatched: t.integer().notNull(),
    quantityDelivered: t.integer().default(0),
    notes: t.text(),
  }),
  (table) => [
    index("idx_dni_note").on(table.deliveryNoteId),
    index("idx_dni_product").on(table.productId),

    workspacePolicy("delivery_note_item"),
  ],
).enableRLS();

export const InternalInvoice = pgTable(
  "internal_invoice",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    invoiceNumber: t.varchar({ length: 32 }).notNull(),
    orderId: t
      .uuid()
      .notNull()
      .references(() => SalesOrder.id),
    customerId: t.uuid().references(() => Customer.id),
    status: documentStatusEnum().notNull().default("draft"),
    subtotal: t.doublePrecision().notNull().default(0),
    discount: t.doublePrecision().default(0),
    tax: t.doublePrecision().default(0),
    total: t.doublePrecision().notNull().default(0),
    issuedAt: t.timestamp({ mode: "date", withTimezone: true }),
    notes: t.text(),
    createdBy: t.uuid().references(() => UserProfile.id),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_invoice_number").on(table.workspaceId, table.invoiceNumber),
    index("idx_inv_order").on(table.orderId),
    index("idx_inv_customer").on(table.customerId),
    index("idx_inv_status").on(table.status),

    workspacePolicy("internal_invoice"),
  ],
).enableRLS();

export const InternalInvoiceItem = pgTable(
  "internal_invoice_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    invoiceId: t
      .uuid()
      .notNull()
      .references(() => InternalInvoice.id, { onDelete: "cascade" }),
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
    index("idx_iii_invoice").on(table.invoiceId),
    index("idx_iii_product").on(table.productId),

    workspacePolicy("internal_invoice_item"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 6 — Vendor Portal & AR                 ║
// ╚══════════════════════════════════════════════╝

export const VendorCommission = pgTable(
  "vendor_commission",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("vendor_commission"),
  ],
).enableRLS();

export const AccountReceivable = pgTable(
  "account_receivable",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    customerId: t
      .uuid()
      .notNull()
      .references(() => Customer.id),
    orderId: t.uuid().references(() => SalesOrder.id),
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

    workspacePolicy("account_receivable"),
  ],
).enableRLS();

// --- AR Installments (PRD §18) ---

export const ArInstallment = pgTable(
  "ar_installment",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    receivableId: t
      .uuid()
      .notNull()
      .references(() => AccountReceivable.id, { onDelete: "cascade" }),
    installmentNumber: t.integer().notNull(),
    amount: t.doublePrecision().notNull(),
    dueDate: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
    status: installmentStatusEnum().notNull().default("pending"),
    paidAmount: t.doublePrecision().default(0),
    paidAt: t.timestamp({ mode: "date", withTimezone: true }),
    notes: t.text(),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_ari_receivable").on(table.receivableId),
    index("idx_ari_status").on(table.status),
    index("idx_ari_due").on(table.dueDate),

    workspacePolicy("ar_installment"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 7 — Integrations (ML + WhatsApp)        ║
// ╚══════════════════════════════════════════════╝

export const MlListing = pgTable(
  "ml_listing",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_ml_item").on(table.workspaceId, table.mlItemId),
    index("idx_ml_product").on(table.productId),
    index("idx_ml_status").on(table.status),

    workspacePolicy("ml_listing"),
  ],
).enableRLS();

export const MlOrder = pgTable(
  "ml_order",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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
    unique("uq_ml_order").on(table.workspaceId, table.mlOrderId),
    index("idx_mlo_listing").on(table.mlListingId),
    index("idx_mlo_imported").on(table.isImported),

    workspacePolicy("ml_order"),
  ],
).enableRLS();

export const IntegrationLog = pgTable(
  "integration_log",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("integration_log"),
  ],
).enableRLS();

export const MercadolibreAccount = pgTable(
  "mercadolibre_account",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    nickname: t.varchar({ length: 128 }).notNull(),
    mlUserId: t.varchar({ length: 64 }),
    accessToken: t.text(),
    refreshToken: t.text(),
    tokenExpiresAt: t.timestamp({ mode: "date", withTimezone: true }),
    isActive: t.boolean().notNull().default(true),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    unique("uq_ml_user").on(table.workspaceId, table.mlUserId),
    workspacePolicy("mercadolibre_account"),
  ],
).enableRLS();

export const MercadolibreOrderEvent = pgTable(
  "mercadolibre_order_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    mlOrderId: t.uuid().references(() => MlOrder.id),
    eventType: t.varchar({ length: 64 }).notNull(),
    payload: t.jsonb(),
    processedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_moe_order").on(table.mlOrderId),
    index("idx_moe_type").on(table.eventType),

    workspacePolicy("mercadolibre_order_event"),
  ],
).enableRLS();

export const IntegrationFailure = pgTable(
  "integration_failure",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    source: t.varchar({ length: 64 }).notNull(),
    errorCode: t.varchar({ length: 64 }),
    errorMessage: t.text().notNull(),
    payload: t.jsonb(),
    retryCount: t.integer().notNull().default(0),
    maxRetries: t.integer().notNull().default(3),
    isResolved: t.boolean().notNull().default(false),
    resolvedBy: t.uuid().references(() => UserProfile.id),
    resolvedAt: t.timestamp({ mode: "date", withTimezone: true }),
    createdAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_if_source").on(table.source),
    index("idx_if_resolved").on(table.isResolved),

    workspacePolicy("integration_failure"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 8 — Dashboard & Alerts                  ║
// ╚══════════════════════════════════════════════╝

export const SystemAlert = pgTable(
  "system_alert",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
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

    workspacePolicy("system_alert"),
  ],
).enableRLS();

// ╔══════════════════════════════════════════════╗
// ║ PHASE 9 — Approvals & Signatures             ║
// ╚══════════════════════════════════════════════╝

export const Approval = pgTable(
  "approval",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    approvalType: approvalTypeEnum().notNull(),
    status: approvalStatusEnum().notNull().default("pending"),
    entityType: t.varchar({ length: 64 }).notNull(),
    entityId: t.uuid().notNull(),
    requestedBy: t
      .uuid()
      .notNull()
      .references(() => UserProfile.id),
    requestedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedBy: t.uuid().references(() => UserProfile.id),
    resolvedAt: t.timestamp({ mode: "date", withTimezone: true }),
    reason: t.text(),
    metadata: t.jsonb(),
    expiresAt: t.timestamp({ mode: "date", withTimezone: true }),
  }),
  (table) => [
    index("idx_approval_type").on(table.approvalType),
    index("idx_approval_status").on(table.status),
    index("idx_approval_entity").on(table.entityType, table.entityId),
    index("idx_approval_requested").on(table.requestedBy),
    index("idx_approval_resolved").on(table.resolvedBy),

    workspacePolicy("approval"),
  ],
).enableRLS();

export const Signature = pgTable(
  "signature",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id)
      .default(sql`current_setting('app.workspace_id')::uuid`),
    approvalId: t
      .uuid()
      .notNull()
      .references(() => Approval.id, { onDelete: "cascade" }),
    signedBy: t
      .uuid()
      .notNull()
      .references(() => UserProfile.id),
    role: userRoleEnum().notNull(),
    action: t.varchar({ length: 32 }).notNull(),
    ipAddress: t.varchar({ length: 45 }),
    signedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (table) => [
    index("idx_sig_approval").on(table.approvalId),
    index("idx_sig_signed_by").on(table.signedBy),

    workspacePolicy("signature"),
  ],
).enableRLS();

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

export const productAttributeRelations = relations(
  ProductAttribute,
  ({ one }) => ({
    product: one(Product, {
      fields: [ProductAttribute.productId],
      references: [Product.id],
    }),
  }),
);

export const productPriceRelations = relations(ProductPrice, ({ one }) => ({
  product: one(Product, {
    fields: [ProductPrice.productId],
    references: [Product.id],
  }),
}));

// --- Catalog Import relations ---

export const categoryAliasRelations = relations(CategoryAlias, ({ one }) => ({
  category: one(Category, {
    fields: [CategoryAlias.categoryId],
    references: [Category.id],
  }),
}));

export const importSessionRelations = relations(ImportSession, ({ many }) => ({
  rows: many(ImportSessionRow),
}));

export const importSessionRowRelations = relations(
  ImportSessionRow,
  ({ one }) => ({
    session: one(ImportSession, {
      fields: [ImportSessionRow.importSessionId],
      references: [ImportSession.id],
    }),
    resolvedCategory: one(Category, {
      fields: [ImportSessionRow.resolvedCategoryId],
      references: [Category.id],
    }),
    resolvedBrand: one(Brand, {
      fields: [ImportSessionRow.resolvedBrandId],
      references: [Brand.id],
    }),
    resolvedProduct: one(Product, {
      fields: [ImportSessionRow.resolvedProductId],
      references: [Product.id],
    }),
  }),
);

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

export const channelAllocationRelations = relations(
  ChannelAllocation,
  ({ one }) => ({
    product: one(Product, {
      fields: [ChannelAllocation.productId],
      references: [Product.id],
    }),
  }),
);

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

export const vendorCommissionRelations = relations(
  VendorCommission,
  ({ one }) => ({
    vendor: one(UserProfile, {
      fields: [VendorCommission.vendorId],
      references: [UserProfile.id],
    }),
    order: one(SalesOrder, {
      fields: [VendorCommission.orderId],
      references: [SalesOrder.id],
    }),
  }),
);

export const accountReceivableRelations = relations(
  AccountReceivable,
  ({ one }) => ({
    customer: one(Customer, {
      fields: [AccountReceivable.customerId],
      references: [Customer.id],
    }),
    order: one(SalesOrder, {
      fields: [AccountReceivable.orderId],
      references: [SalesOrder.id],
    }),
  }),
);

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

// --- Phase 9 relations ---

export const approvalRelations = relations(Approval, ({ one, many }) => ({
  requestedByUser: one(UserProfile, {
    fields: [Approval.requestedBy],
    references: [UserProfile.id],
    relationName: "approvalRequester",
  }),
  resolvedByUser: one(UserProfile, {
    fields: [Approval.resolvedBy],
    references: [UserProfile.id],
    relationName: "approvalResolver",
  }),
  signatures: many(Signature),
}));

export const signatureRelations = relations(Signature, ({ one }) => ({
  approval: one(Approval, {
    fields: [Signature.approvalId],
    references: [Approval.id],
  }),
  user: one(UserProfile, {
    fields: [Signature.signedBy],
    references: [UserProfile.id],
  }),
}));

// --- Multi-tenancy relations ---

export const workspaceRelations = relations(Workspace, ({ one, many }) => ({
  organization: one(Organization, {
    fields: [Workspace.organizationId],
    references: [Organization.id],
  }),
  members: many(WorkspaceMember),
  modules: many(WorkspaceModule),
  profile: one(WorkspaceProfile, {
    fields: [Workspace.id],
    references: [WorkspaceProfile.workspaceId],
  }),
  quota: one(WorkspaceQuota, {
    fields: [Workspace.id],
    references: [WorkspaceQuota.workspaceId],
  }),
  sequences: many(DocumentSequence),
  notificationBuckets: many(NotificationBucket),
}));

export const workspaceMemberRelations = relations(
  WorkspaceMember,
  ({ one }) => ({
    workspace: one(Workspace, {
      fields: [WorkspaceMember.workspaceId],
      references: [Workspace.id],
    }),
    user: one(UserProfile, {
      fields: [WorkspaceMember.userId],
      references: [UserProfile.id],
    }),
  }),
);

export const workspaceModuleRelations = relations(
  WorkspaceModule,
  ({ one }) => ({
    workspace: one(Workspace, {
      fields: [WorkspaceModule.workspaceId],
      references: [Workspace.id],
    }),
  }),
);

export const workspaceQuotaRelations = relations(WorkspaceQuota, ({ one }) => ({
  workspace: one(Workspace, {
    fields: [WorkspaceQuota.workspaceId],
    references: [Workspace.id],
  }),
}));

export const workspaceProfileRelations = relations(
  WorkspaceProfile,
  ({ one }) => ({
    workspace: one(Workspace, {
      fields: [WorkspaceProfile.workspaceId],
      references: [Workspace.id],
    }),
  }),
);

export const documentSequenceRelations = relations(
  DocumentSequence,
  ({ one }) => ({
    workspace: one(Workspace, {
      fields: [DocumentSequence.workspaceId],
      references: [Workspace.id],
    }),
  }),
);

export const notificationBucketRelations = relations(
  NotificationBucket,
  ({ one, many }) => ({
    workspace: one(Workspace, {
      fields: [NotificationBucket.workspaceId],
      references: [Workspace.id],
    }),
    assignees: many(NotificationBucketAssignee),
    routingRules: many(NotificationRoutingRule),
  }),
);

export const notificationBucketAssigneeRelations = relations(
  NotificationBucketAssignee,
  ({ one }) => ({
    bucket: one(NotificationBucket, {
      fields: [NotificationBucketAssignee.bucketId],
      references: [NotificationBucket.id],
    }),
    member: one(WorkspaceMember, {
      fields: [NotificationBucketAssignee.memberId],
      references: [WorkspaceMember.id],
    }),
  }),
);

export const notificationRoutingRuleRelations = relations(
  NotificationRoutingRule,
  ({ one }) => ({
    bucket: one(NotificationBucket, {
      fields: [NotificationRoutingRule.bucketId],
      references: [NotificationBucket.id],
    }),
  }),
);

// ╔══════════════════════════════════════════════╗
// ║ TYPE EXPORTS                                ║
// ╚══════════════════════════════════════════════╝

export type WorkspaceSelect = typeof Workspace.$inferSelect;
export type WorkspaceInsert = typeof Workspace.$inferInsert;
export type WorkspaceMemberSelect = typeof WorkspaceMember.$inferSelect;
export type WorkspaceMemberInsert = typeof WorkspaceMember.$inferInsert;
export type WorkspaceModuleSelect = typeof WorkspaceModule.$inferSelect;
export type WorkspaceModuleInsert = typeof WorkspaceModule.$inferInsert;
export type WorkspaceQuotaSelect = typeof WorkspaceQuota.$inferSelect;
export type WorkspaceQuotaInsert = typeof WorkspaceQuota.$inferInsert;
export type WorkspaceProfileSelect = typeof WorkspaceProfile.$inferSelect;
export type WorkspaceProfileInsert = typeof WorkspaceProfile.$inferInsert;
export type DocumentSequenceSelect = typeof DocumentSequence.$inferSelect;
export type NotificationBucketSelect = typeof NotificationBucket.$inferSelect;
