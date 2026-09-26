/**
 * Public-site copy registry (PLAN-2026-09-LANDING-REDESIGN §4.3).
 *
 * Every factual statement published on the landing or the feature pages is a
 * `Claim` with its evidence: a repository path that proves it, or
 * `user:YYYY-MM-DD` when the owner decided it. `content.guard.test.ts`
 * enforces both the sources and a list of forbidden (untrue) claims.
 * Numbers are imported from the code that enforces them, never typed here.
 */
import type { IconName } from "@cendaro/ui/icons";
import type { ErpModule } from "@cendaro/validators";
import {
  ERP_MODULES,
  MAX_AUTOMATIC_RATE_DEVIATION,
  STARTER_MODULES,
  STARTER_QUOTA,
  USER_ROLES,
} from "@cendaro/validators";

export interface Claim {
  text: string;
  /** Repository path (from the repo root) or "user:YYYY-MM-DD". */
  source: string;
}

const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;

export const FACTS = {
  modules: ERP_MODULES.length,
  roles: USER_ROLES.length,
  rateHoldPct: pct(MAX_AUTOMATIC_RATE_DEVIATION),
  starter: STARTER_QUOTA,
  starterModules: STARTER_MODULES.length,
} as const;

const ISOLATION_SOURCE =
  "packages/db/migrations/022_workspace_select_scoped.sql";

// ── Hero ────────────────────────────────────────────────────────────────
export const HERO = {
  pill: {
    label: "Nuevo",
    text: "Packing lists leídos con IA",
    href: "#como-funciona",
  },
  title: ["Vende, importa y cobra", "desde un solo sistema"],
  lead: "Inventario, punto de venta, importaciones y cobranzas en dólares y bolívares, con la tasa BCV al día. Hecho para distribuidoras y comercios en Venezuela.",
  note: "Te respondemos por WhatsApp · Migración asistida desde tu Excel",
} as const;

/** Screen-reader descriptions of the recordings (mirror scripts/landing-media/storyboards.mjs). */
export const HERO_VIDEO_LABEL =
  "Grabación del panel de Cendaro con ventas, cuentas por cobrar y stock bajo, y la búsqueda global encontrando un pedido.";

export const CLIP_LABELS = {
  "flow-catalog-import":
    "Asistente de importación: sube un Excel, reconoce las columnas, valida cada fila y sugiere categorías.",
  "flow-container-ai":
    "Contenedor en tránsito: se sube el packing list del proveedor y la IA lista productos, cantidades y costos emparejados con el catálogo.",
  "flow-orders-sale":
    "Pedidos: búsqueda por cliente, detalle con totales en dólares y bolívares y cambio de estado.",
  "flow-receivables-close":
    "Cuentas por cobrar con antigüedad y registro de un abono con su equivalente en bolívares.",
  "flow-inventory-stock":
    "Inventario por almacén y canal, con filtro de stock bajo y agotado.",
  "flow-rates-bcv":
    "Tasas de cambio: BCV, paralelo y USD/CNY, brecha cambiaria, calculadora multi-moneda e historial.",
} as const;

// ── Proof strip (numbers from code) ───────────────────────────────────────
export const PROOF: readonly { value: string; label: string }[] = [
  { value: String(FACTS.modules), label: "módulos en un solo sistema" },
  { value: String(FACTS.roles), label: "roles con permisos por acción" },
  { value: "USD · Bs", label: "precios en dólares, cobro en bolívares" },
  { value: "Diaria", label: "sincronización de la tasa BCV" },
];

// ── How it works (the real flow of a distributor) ─────────────────────────
export type StepId = "catalogo" | "importacion" | "venta" | "cobranza";

export interface Step {
  id: StepId;
  index: string;
  title: string;
  body: string;
  bullets: readonly string[];
  /** App route the step lives in (also its evidence). */
  path: string;
}

export const STEPS: readonly Step[] = [
  {
    id: "catalogo",
    index: "01",
    title: "Carga tu catálogo desde Excel",
    body: "Sube tu archivo tal como lo tienes. Cendaro reconoce las columnas, valida cada fila antes de guardar y te sugiere la categoría de lo que no encaja.",
    bullets: [
      "Plantilla descargable",
      "Validación y vista previa",
      "Sugerencia de categorías",
    ],
    path: "/catalog/import",
  },
  {
    id: "importacion",
    index: "02",
    title: "Recibe tu mercancía sin transcribir",
    body: "Sube el packing list del contenedor en PDF o Excel. La IA extrae productos, cantidades y costos, los empareja con tu catálogo y tú solo confirmas.",
    bullets: [
      "PDF y Excel, incluidas sus fotos",
      "Emparejamiento con tu catálogo",
      "Recepción por contenedor",
    ],
    path: "/containers",
  },
  {
    id: "venta",
    index: "03",
    title: "Vende en mostrador, por pedido o en la calle",
    body: "Punto de venta con los datos fiscales del cliente, pedidos con su recorrido completo y cotizaciones que tus vendedores convierten en pedido.",
    bullets: [
      "RIF y cédula validados",
      "Pedidos, cotizaciones y notas de entrega",
      "Enlace de WhatsApp con el pedido",
    ],
    path: "/pos",
  },
  {
    id: "cobranza",
    index: "04",
    title: "Cobra y cierra la caja",
    body: "Registra pago móvil, transferencias, Zelle o efectivo; controla las cuentas por cobrar y cuadra la caja cada día con sus diferencias a la vista.",
    bullets: [
      "Cuentas por cobrar con vencimientos",
      "Pagos validados",
      "Cierre de caja revisado",
    ],
    path: "/accounts-receivable",
  },
];

// ── Modules grid ──────────────────────────────────────────────────────────
export type ModuleGroup =
  "Operación" | "Ventas" | "Finanzas" | "Canales" | "Control";

export interface ModuleInfo {
  name: string;
  line: string;
  icon: IconName;
  group: ModuleGroup;
  href?: string;
}

export const MODULES: Readonly<Record<ErpModule, ModuleInfo>> = {
  dashboard: {
    name: "Panel",
    line: "Ventas, stock y alertas del día en una pantalla",
    icon: "Dashboard",
    group: "Control",
  },
  catalog: {
    name: "Catálogo",
    line: "Productos, marcas, categorías y proveedores",
    icon: "Category",
    group: "Operación",
  },
  inventory: {
    name: "Inventario",
    line: "Stock por almacén, traslados y conteos",
    icon: "Inventory2",
    group: "Operación",
  },
  containers: {
    name: "Importaciones",
    line: "Contenedores y packing lists leídos con IA",
    icon: "DirectionsBoat",
    group: "Operación",
  },
  pricing: {
    name: "Precios",
    line: "Listas de precios y recálculo con aprobación",
    icon: "PriceChange",
    group: "Finanzas",
  },
  rates: {
    name: "Tasas",
    line: "BCV, paralela y USD/CNY sincronizadas",
    icon: "CurrencyExchange",
    group: "Finanzas",
  },
  pos: {
    name: "Punto de venta",
    line: "Venta en mostrador con datos fiscales",
    icon: "PointOfSale",
    group: "Ventas",
  },
  orders: {
    name: "Pedidos",
    line: "Del borrador a la entrega, con su historial",
    icon: "ShoppingCart",
    group: "Ventas",
  },
  customers: {
    name: "Clientes",
    line: "RIF, cédula, crédito y saldo de cada cliente",
    icon: "Group",
    group: "Ventas",
  },
  vendors: {
    name: "Vendedores",
    line: "Cartera, pedidos y comisiones por vendedor",
    icon: "Badge",
    group: "Ventas",
  },
  payments: {
    name: "Pagos",
    line: "Pago móvil, transferencia, Zelle y efectivo",
    icon: "Payments",
    group: "Finanzas",
  },
  cash_closure: {
    name: "Cierre de caja",
    line: "Cuadre diario con diferencias a la vista",
    icon: "AccountBalanceWallet",
    group: "Finanzas",
  },
  receivables: {
    name: "Cuentas por cobrar",
    line: "Crédito, cuotas y vencimientos",
    icon: "RequestQuote",
    group: "Finanzas",
  },
  marketplace: {
    name: "Mercado Libre",
    line: "Publicaciones y pedidos junto a tu stock",
    icon: "Storefront",
    group: "Canales",
  },
  whatsapp: {
    name: "WhatsApp",
    line: "Pedidos y clientes con enlace directo al chat",
    icon: "Chat",
    group: "Canales",
  },
  users: {
    name: "Usuarios y roles",
    line: "Seis roles, permisos por módulo y acción",
    icon: "ManageAccounts",
    group: "Control",
  },
  audit: {
    name: "Auditoría",
    line: "Quién cambió qué, y cuándo",
    icon: "History",
    group: "Control",
  },
  settings: {
    name: "Configuración",
    line: "Empresa, datos fiscales y seguridad",
    icon: "Settings",
    group: "Control",
  },
};

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  "Operación",
  "Ventas",
  "Finanzas",
  "Canales",
  "Control",
];

// ── Before / after ─────────────────────────────────────────────────────────
export const BEFORE_AFTER: readonly { before: string; after: string }[] = [
  {
    before: "Copias la tasa del BCV cada mañana y recalculas en Excel.",
    after:
      "La tasa se sincroniza sola cada día y los precios en bolívares salen de ella.",
  },
  {
    before: "Transcribes el packing list del contenedor línea por línea.",
    after: "La IA lee el PDF o el Excel y tú solo confirmas lo que llegó.",
  },
  {
    before: "El stock vive en un cuaderno y nunca cuadra con la tienda.",
    after: "Cada almacén con su stock, sus traslados y sus conteos aprobados.",
  },
  {
    before: "Los pedidos llegan sueltos por chat y se pierden.",
    after:
      "Cada pedido con su estado, su cliente y un enlace directo a WhatsApp.",
  },
  {
    before: "Lo que te deben está en una libreta.",
    after: "Cuentas por cobrar con vencimientos, cuotas y pagos aplicados.",
  },
];

// ── Security & control (verifiable checklist) ─────────────────────────────
export const SECURITY: readonly Claim[] = [
  {
    text: "Los datos de cada empresa están aislados a nivel de base de datos.",
    source: ISOLATION_SOURCE,
  },
  {
    text: `${FACTS.roles} roles con permisos por módulo y por acción, verificados en el servidor.`,
    source: "packages/validators/src/authz.ts",
  },
  {
    text: "Verificación en dos pasos con aplicación autenticadora.",
    source: "apps/erp/src/app/(app)/settings/security/page.tsx",
  },
  {
    text: "La sesión se cierra sola tras 30 minutos sin actividad.",
    source: "apps/erp/src/proxy.ts",
  },
  {
    text: "Intentos de acceso limitados y bloqueo temporal ante abusos.",
    source: "apps/erp/src/app/api/auth/login/route.ts",
  },
  {
    text: "Cada cambio importante queda en el registro de auditoría.",
    source: "packages/api/src/modules/audit.ts",
  },
];

// ── Plans (owner delegated the offer, user:2026-09-25) ────────────────────
export interface Plan {
  id: "starter" | "pro" | "empresa";
  name: string;
  audience: string;
  highlights: readonly string[];
  onboarding: string;
  recommended?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "Para una tienda o distribuidora pequeña que sale del Excel.",
    highlights: [
      "Catálogo, inventario, pedidos, punto de venta, clientes y pagos",
      `${FACTS.starter.maxUsers} usuario · ${FACTS.starter.maxWarehouses} almacén`,
      `Hasta ${FACTS.starter.maxProducts} productos y ${FACTS.starter.maxCustomers} clientes`,
    ],
    onboarding: "Activación guiada",
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Para la distribuidora que importa y vende por varios canales.",
    highlights: [
      "Todo Starter, más importaciones con IA",
      "Tasas automáticas, precios y cuentas por cobrar",
      "Vendedores con comisiones, WhatsApp y Mercado Libre",
      "Hasta 10 usuarios y 3 almacenes",
    ],
    onboarding: "Migración asistida de tu catálogo y stock",
    recommended: true,
  },
  {
    id: "empresa",
    name: "Empresa",
    audience: "Para operaciones con varios almacenes, equipos o empresas.",
    highlights: [
      `Los ${FACTS.modules} módulos`,
      "Usuarios y almacenes sin límite",
      "Varias empresas en una cuenta",
      "Contacto dedicado",
    ],
    onboarding: "Migración, diseño de roles y capacitación del equipo",
  },
];

export const OFFER: readonly { title: string; body: string }[] = [
  {
    title: "Diagnóstico gratis",
    body: "30 minutos para entender cómo trabaja tu negocio hoy, antes de hablar de planes.",
  },
  {
    title: "Tu Excel, nuestro problema",
    body: "En Pro y Empresa cargamos tu catálogo y tu stock inicial desde tus archivos.",
  },
  {
    title: "Primera semana acompañada",
    body: "Seguimiento diario mientras tu equipo empieza a usar Cendaro.",
  },
  {
    title: "Sin permanencia",
    body: "Tus datos son tuyos; si decides irte, te los entregamos.",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────
export interface FaqItem {
  q: string;
  a: string;
  source: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    q: "¿Cómo empiezo a usar Cendaro?",
    a: "Escríbenos por WhatsApp. Hacemos un diagnóstico de 30 minutos, activamos tu empresa y, según el plan, cargamos tu catálogo y tu stock desde tus archivos. No hay registro automático: cada empresa se activa acompañada.",
    source: "user:2026-09-25",
  },
  {
    q: "¿Maneja dólares y bolívares a la vez?",
    a: "Sí. Los precios viven en dólares y se convierten a bolívares con la tasa BCV del día. Cada venta, pago y cierre muestra ambas monedas.",
    source: "packages/api/src/modules/pricing.ts",
  },
  {
    q: "¿De dónde sale la tasa y qué pasa si se dispara?",
    a: `Cendaro consulta el BCV cada día (con DolarAPI como respaldo) y también la paralela y el USD/CNY. Si la tasa cambia más de ${FACTS.rateHoldPct} de golpe, no se aplica sola: espera la aprobación de un responsable.`,
    source: "packages/api/src/modules/rate-sync.ts",
  },
  {
    q: "¿Puedo importar mi catálogo desde Excel?",
    a: "Sí. El importador reconoce tus columnas, valida cada fila, te muestra una vista previa y sugiere la categoría de los productos antes de guardar nada.",
    source: "packages/api/src/modules/catalog-import.ts",
  },
  {
    q: "¿Qué hace la IA con mis packing lists?",
    a: "Lee el packing list del contenedor en PDF o Excel —también las fotos que traiga el Excel—, extrae productos, cantidades y costos, y los empareja con tu catálogo. Tú revisas y confirmas.",
    source: "apps/erp/src/app/api/ai/parse-packing-list/route.ts",
  },
  {
    q: "¿Mis vendedores ven toda la información?",
    a: `No. Hay ${FACTS.roles} roles: cada vendedor ve solo sus clientes, sus pedidos y sus comisiones; el cajero vende y cierra caja; los cambios sensibles quedan para dueños y administradores.`,
    source: "packages/validators/src/authz.ts",
  },
  {
    q: "¿Funciona en el teléfono?",
    a: "Sí. Cendaro funciona en el navegador del teléfono, la tableta o la computadora; no hay que instalar nada.",
    source: "apps/erp/src/app/layout.tsx",
  },
  {
    q: "¿Qué tan seguros están mis datos?",
    a: "Los datos de cada empresa están aislados en la base de datos, el acceso admite verificación en dos pasos y cada cambio importante queda registrado en la auditoría.",
    source: ISOLATION_SOURCE,
  },
];

// ── Final CTA ─────────────────────────────────────────────────────────────
export const FINAL_CTA = {
  title: "Tu operación, en orden.",
  lead: "Cuéntanos cómo trabajas hoy. En 30 minutos te mostramos cómo se vería en Cendaro.",
} as const;

/** Every factual statement above, for the truth guard. */
export const CLAIMS: readonly Claim[] = [
  ...SECURITY,
  ...FAQ.map(({ a, source }) => ({ text: a, source })),
  {
    text: HERO.pill.text,
    source: "apps/erp/src/app/api/ai/parse-packing-list/route.ts",
  },
  { text: HERO.lead, source: "packages/api/src/modules/rate-sync.ts" },
  ...STEPS.map((s) => ({
    text: s.body,
    source: `apps/erp/src/app/(app)${s.path}/page.tsx`,
  })),
  ...OFFER.map((o) => ({
    text: `${o.title}: ${o.body}`,
    source: "user:2026-09-25",
  })),
  ...PLANS.map((p) => ({
    text: p.highlights.join(" · "),
    source:
      p.id === "starter"
        ? "packages/validators/src/plans.ts"
        : "user:2026-09-25",
  })),
];
