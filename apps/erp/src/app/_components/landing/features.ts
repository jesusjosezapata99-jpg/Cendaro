/**
 * Feature-page copy (PLAN-2026-09-LANDING-REDESIGN §6.2, F5). Same rules as
 * `content.ts`: every step, capability and answer cites the file that proves
 * it (checked on 2026-09-25 against the routers and components named below),
 * and `content.guard.test.ts` verifies those files exist.
 *
 * Deliberately left out until the code supports them: automatic repricing
 * (the `record_price_change` trigger fails in production, so no repricing
 * event is ever created) and configurable low-stock thresholds (the
 * threshold is a fixed 5 units in `inventory.ts`).
 */
import type { ErpModule } from "@cendaro/validators";

import type { Claim, CLIP_LABELS, FaqItem } from "./content";
import { FACTS } from "./content";

export type FeatureSlug =
  | "inventario"
  | "importaciones"
  | "finanzas"
  | "ventas-y-pos"
  | "canales"
  | "seguridad-y-control";

export interface FeatureStep extends Claim {
  title: string;
}

export interface FeaturePage {
  slug: FeatureSlug;
  /** Short name for navigation, breadcrumbs and the index. */
  name: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** <title> (≤ 60 chars) and meta description (≤ 155 chars). */
  metaTitle: string;
  metaDescription: string;
  steps: readonly FeatureStep[];
  capabilities: readonly Claim[];
  /** Why this matters compared with doing it by hand. */
  difference: { title: string; body: string };
  modules: readonly ErpModule[];
  faq: readonly FaqItem[];
}

const CATALOG_IMPORT = "packages/api/src/modules/catalog-import.ts";
const INVENTORY = "packages/api/src/modules/inventory.ts";
const CONTAINERS = "packages/api/src/modules/containers.ts";
const PACKING_LIST = "apps/erp/src/app/api/ai/parse-packing-list/route.ts";
const RATE_SYNC = "packages/api/src/modules/rate-sync.ts";
const PAYMENTS = "packages/api/src/modules/payments.ts";
const RECEIVABLES = "packages/api/src/modules/receivables.ts";
const SALES = "packages/api/src/modules/sales.ts";
const QUOTES = "packages/api/src/modules/quotes.ts";
const FISCAL = "packages/api/src/modules/fiscal.ts";
const VENDORS = "packages/api/src/modules/vendors.ts";
const POS_CLIENT = "apps/erp/src/app/(app)/pos/client.tsx";
const WHATSAPP_CLIENT = "apps/erp/src/app/(app)/whatsapp/client.tsx";
const MARKETPLACE_CLIENT = "apps/erp/src/app/(app)/marketplace/client.tsx";
const INTEGRATIONS = "packages/api/src/modules/integrations.ts";
const AUTHZ = "packages/validators/src/authz.ts";
const AUDIT = "packages/api/src/modules/audit.ts";
const ISOLATION = "packages/db/migrations/022_workspace_select_scoped.sql";
const SECURITY_SETTINGS = "apps/erp/src/app/(app)/settings/security/page.tsx";
const LOGIN_ROUTE = "apps/erp/src/app/api/auth/login/route.ts";
const PROXY = "apps/erp/src/proxy.ts";

export const FEATURES: Readonly<Record<FeatureSlug, FeaturePage>> = {
  inventario: {
    slug: "inventario",
    name: "Inventario y catálogo",
    eyebrow: "Inventario y catálogo",
    title: "Tu stock, exacto en cada almacén",
    lead: "Catálogo, existencias por almacén, traslados y conteos en un solo lugar. Sabes qué tienes, dónde está y quién lo movió.",
    metaTitle: "Inventario y catálogo por almacén — Cendaro",
    metaDescription:
      "Carga tu catálogo desde Excel, controla el stock de cada almacén, registra traslados y conteos aprobados. ERP para distribuidoras en Venezuela.",
    steps: [
      {
        title: "Carga tu catálogo desde Excel",
        text: "Descarga la plantilla o sube tu propio archivo. Cendaro valida cada fila, te muestra una vista previa y recuerda cómo llamas a tus categorías para la próxima importación.",
        source: CATALOG_IMPORT,
      },
      {
        title: "Inicializa el stock de cada almacén",
        text: "Importa existencias por almacén desde Excel para inicializar, ajustar o reemplazar cantidades, con una plantilla para cada caso.",
        source: "packages/api/src/modules/inventory-import.ts",
      },
      {
        title: "Traslada entre almacenes",
        text: "Mueve mercancía de un almacén a otro. Cada traslado queda como movimiento, con su responsable, en el historial y en la auditoría.",
        source: INVENTORY,
      },
      {
        title: "Cuenta y aprueba",
        text: "Tu equipo registra lo que cuenta en físico; las diferencias quedan anotadas y un responsable finaliza el conteo.",
        source: INVENTORY,
      },
      {
        title: "Ve lo que se está acabando",
        text: "Filtra por stock bajo o agotado en cada almacén, y el panel te muestra cuántos productos están por acabarse.",
        source: "packages/api/src/modules/dashboard.ts",
      },
    ],
    capabilities: [
      { text: "Varios almacenes, según tu plan", source: INVENTORY },
      {
        text: "Marcas, categorías y proveedores",
        source: "apps/erp/src/app/(app)/catalog/brands/page.tsx",
      },
      { text: "Historial de movimientos por producto", source: INVENTORY },
      { text: "Conteos físicos con aprobación", source: INVENTORY },
      {
        text: "Plantillas de Excel con instrucciones",
        source:
          "apps/erp/src/modules/catalog-import/lib/catalog-template-builder.ts",
      },
      {
        text: "Cada cambio en la auditoría",
        source: "packages/api/src/modules/audit.ts",
      },
    ],
    difference: {
      title: "El stock deja de ser una opinión",
      body: "Cuando cada entrada, traslado y conteo pasa por el sistema, la cifra de la pantalla es la del almacén. Y si no lo es, el conteo te dice cuánto y dónde.",
    },
    modules: ["catalog", "inventory", "containers", "audit"],
    faq: [
      {
        q: "¿Puedo usar mi Excel actual?",
        a: "Sí. Puedes subir tu propio archivo o partir de la plantilla, que trae instrucciones y ejemplos. Antes de guardar nada ves una vista previa con los errores de cada fila.",
        source: CATALOG_IMPORT,
      },
      {
        q: "¿Cuántos almacenes puedo tener?",
        a: `Depende del plan: Starter incluye ${FACTS.starter.maxWarehouses} almacén, Pro hasta 3 y Empresa sin límite.`,
        // Starter comes from plans.ts; Pro/Empresa are the owner's offer.
        source: "user:2026-09-25",
      },
      {
        q: "¿Qué pasa si el conteo no cuadra?",
        a: "La diferencia de cada producto queda registrada con el conteo, y un responsable lo revisa y lo finaliza. Nada se pierde en una hoja suelta.",
        source: INVENTORY,
      },
    ],
  },

  importaciones: {
    slug: "importaciones",
    name: "Importaciones con IA",
    eyebrow: "Importaciones con IA",
    title: "Del packing list al inventario, sin transcribir",
    lead: "Registra cada contenedor, sube el packing list del proveedor y deja que la IA lo convierta en líneas listas para recibir.",
    metaTitle: "Importaciones y packing lists con IA — Cendaro",
    metaDescription:
      "Sube el packing list de tu contenedor en Excel o PDF: la IA extrae productos, cantidades y costos y los empareja con tu catálogo.",
    steps: [
      {
        title: "Crea el contenedor",
        text: "Número, proveedor, fechas de salida y llegada y costo FOB. Lo sigues de creado a en tránsito, recibido y cerrado.",
        source: CONTAINERS,
      },
      {
        title: "Sube el packing list",
        text: "En Excel (.xlsx o .xls) o en PDF, tal como te lo envía el proveedor. Si el Excel trae fotos de los productos, también se leen.",
        source: PACKING_LIST,
      },
      {
        title: "La IA extrae las líneas",
        text: "Productos, cantidades y costos salen del documento, y cada línea se empareja con un producto de tu catálogo o se marca como nueva.",
        source: CONTAINERS,
      },
      {
        title: "Revisa y corrige",
        text: "Corriges lo que haga falta antes de confirmar. Tus correcciones se guardan como ejemplos para las próximas lecturas.",
        source: CONTAINERS,
      },
      {
        title: "Cierra el contenedor",
        text: "Solo dueños y administradores pueden cerrarlo. Queda registrado quién lo cerró y cuándo.",
        source: CONTAINERS,
      },
    ],
    capabilities: [
      { text: "Excel y PDF", source: PACKING_LIST },
      { text: "Fotos del Excel incluidas", source: PACKING_LIST },
      { text: "Emparejamiento con tu catálogo", source: CONTAINERS },
      { text: "Aprende de tus correcciones", source: CONTAINERS },
      { text: "Instrucciones de la IA ajustables", source: CONTAINERS },
      { text: "Cierre solo por dueño o administrador", source: CONTAINERS },
    ],
    difference: {
      title: "Un contenedor ya no es una semana de transcripción",
      body: "El packing list llega en inglés, con los nombres del proveedor. Cendaro lo lee, lo cruza con tu catálogo y te deja solo las dudas.",
    },
    modules: ["containers", "catalog", "inventory", "settings"],
    faq: [
      {
        q: "¿Qué formatos acepta?",
        a: "Excel (.xlsx y .xls) y PDF. Si tu Excel trae fotos de los productos, la IA también las usa para identificarlos.",
        source: PACKING_LIST,
      },
      {
        q: "¿Y si la IA se equivoca?",
        a: "Nada se guarda sin tu confirmación: revisas cada línea y corriges lo necesario. Las correcciones se guardan como ejemplos para que la próxima lectura acierte más.",
        source: CONTAINERS,
      },
      {
        q: "¿Quién puede cerrar un contenedor?",
        a: "Solo el dueño y los administradores. Los demás roles con acceso pueden crearlo, subir el packing list y recibirlo.",
        source: CONTAINERS,
      },
    ],
  },

  finanzas: {
    slug: "finanzas",
    name: "Finanzas en doble moneda",
    eyebrow: "Tasas, cobranzas y caja",
    title: "Precios en dólares, cobros en bolívares, cuentas claras",
    lead: "La tasa BCV llega sola cada día, los saltos bruscos esperan aprobación, y cada pago, cuenta por cobrar y cierre de caja cuadra en las dos monedas.",
    metaTitle: "Tasa BCV, cobranzas y cierre de caja — Cendaro",
    metaDescription:
      "Tasa BCV sincronizada a diario, pagos en pago móvil, transferencia, Zelle o efectivo, cuentas por cobrar con cuotas y cierre de caja con diferencias.",
    steps: [
      {
        title: "La tasa BCV llega sola",
        text: "Cada día a las 6:00 p. m., hora de Venezuela, Cendaro consulta el BCV —con DolarAPI de respaldo— además de la paralela y el USD/CNY.",
        source: "vercel.json",
      },
      {
        title: "Los saltos esperan aprobación",
        text: `Si la tasa cambia más de ${FACTS.rateHoldPct} de golpe no se aplica sola: queda retenida hasta que un dueño o administrador la acepte.`,
        source: RATE_SYNC,
      },
      {
        title: "Registra los pagos",
        text: "Pago móvil, transferencia, Zelle, efectivo o punto de venta. Cada pago se registra y luego se valida.",
        source: PAYMENTS,
      },
      {
        title: "Controla lo que te deben",
        text: "Cuentas por cobrar con cuotas y fechas de vencimiento, y su estado a la vista: pendiente, parcial, pagada o vencida.",
        source: RECEIVABLES,
      },
      {
        title: "Cierra la caja",
        text: "Declaras lo contado, Cendaro calcula la diferencia con lo esperado y un responsable revisa el cierre.",
        source: PAYMENTS,
      },
    ],
    capabilities: [
      { text: "BCV, paralela y USD/CNY", source: RATE_SYNC },
      {
        text: "Historial de tasas",
        source: "packages/api/src/modules/pricing.ts",
      },
      { text: "Aprobación de tasas retenidas", source: RATE_SYNC },
      { text: "Cinco métodos de pago", source: PAYMENTS },
      { text: "Cuotas y vencimientos", source: RECEIVABLES },
      { text: "Diferencias de caja a la vista", source: PAYMENTS },
    ],
    difference: {
      title: "La tasa ya no se copia a mano",
      body: "Nadie tiene que buscar el BCV cada tarde ni recalcular en Excel. Y si la fuente publica un dato raro, no llega a tus precios sin que alguien lo apruebe.",
    },
    modules: ["rates", "payments", "receivables", "cash_closure"],
    faq: [
      {
        q: "¿A qué hora se actualiza la tasa?",
        a: "Todos los días a las 6:00 p. m., hora de Venezuela. Un responsable también puede sincronizarla a mano desde la pantalla de tasas.",
        source: "vercel.json",
      },
      {
        q: "¿Qué pasa si el BCV publica un dato extraño?",
        a: `Si la nueva tasa se aleja más de ${FACTS.rateHoldPct} de la anterior, queda retenida y aparece como alerta. Solo un dueño o administrador puede aceptarla.`,
        source: RATE_SYNC,
      },
      {
        q: "¿Puedo dar crédito en cuotas?",
        a: "Sí. Divides la cuenta por cobrar en cuotas con su fecha de vencimiento y ves cuáles están pendientes, parciales, pagadas o vencidas.",
        source: RECEIVABLES,
      },
    ],
  },

  "ventas-y-pos": {
    slug: "ventas-y-pos",
    name: "Ventas, POS y vendedores",
    eyebrow: "Mostrador, pedidos y calle",
    title: "Vende en mostrador, por pedido o con tu equipo en la calle",
    lead: "Punto de venta con datos fiscales, cotizaciones que pasan a pedido en un clic, notas de entrega y comisiones por vendedor en dólares y bolívares.",
    metaTitle: "Punto de venta, pedidos y vendedores — Cendaro",
    metaDescription:
      "Vende en mostrador con RIF y cédula, convierte cotizaciones en pedidos, emite notas de entrega y calcula comisiones por vendedor en Venezuela.",
    steps: [
      {
        title: "Registra al cliente con su RIF o cédula",
        text: "Guarda datos fiscales, direcciones, límite de crédito y saldo pendiente. El sistema normaliza y valida el formato antes de facturar.",
        source: SALES,
      },
      {
        title: "Cotiza y convierte en pedido",
        text: "Envía una cotización con fecha de vigencia y, cuando el cliente aprueba, conviértela en pedido sin volver a cargar los productos.",
        source: QUOTES,
      },
      {
        title: "Cobra en mostrador con el punto de venta",
        text: "Busca productos al instante, aplica el desglose fiscal (IVA e IGTF para pagos en divisas) y cobra en dólares o bolívares a tasa BCV.",
        source: POS_CLIENT,
      },
      {
        title: "Despacha con nota de entrega o factura",
        text: "Sigue el pedido de borrador a confirmado, despachado y entregado, generando su nota de entrega o documento fiscal.",
        source: FISCAL,
      },
      {
        title: "Liquida las comisiones de tus vendedores",
        text: "Cada vendedor atiende su cartera de clientes y ve sus pedidos y comisiones calculadas según el monto cobrado.",
        source: VENDORS,
      },
    ],
    capabilities: [
      { text: "RIF y cédula validados", source: SALES },
      { text: "Cotizaciones convertibles en pedido", source: QUOTES },
      { text: "Desglose de IVA e IGTF", source: FISCAL },
      { text: "Notas de entrega y facturas", source: SALES },
      { text: "Cartera asignada por vendedor", source: VENDORS },
      { text: "Cálculo y pago de comisiones", source: VENDORS },
    ],
    difference: {
      title: "Mostrador y calle sobre el mismo inventario",
      body: "Lo que vende la tienda en el punto de venta y lo que compromete un vendedor en la calle descuenta del mismo stock y alimenta la misma cobranza.",
    },
    modules: ["pos", "orders", "customers", "vendors", "pricing"],
    faq: [
      {
        q: "¿Valida el RIF y la cédula de los clientes?",
        a: "Sí. Cendaro normaliza el formato del documento fiscal (V, E, J, G, P) y verifica que el cliente tenga los datos completos antes de emitir documentos.",
        source: SALES,
      },
      {
        q: "¿Calcula el IVA y el IGTF del 3 %?",
        a: "Sí. El motor fiscal separa alícuota general (16 %), reducida (8 %) y exentos, y calcula el 3 % de IGTF sobre la base pagada en divisas.",
        source: FISCAL,
      },
      {
        q: "¿Un vendedor puede ver los clientes de otro?",
        a: "No. El rol de vendedor solo accede a su propia cartera de clientes, sus cotizaciones, sus pedidos y sus comisiones.",
        source: "packages/api/src/modules/vendor-scope.ts",
      },
    ],
  },

  canales: {
    slug: "canales",
    name: "WhatsApp y Mercado Libre",
    eyebrow: "Canales de venta",
    title: "Tus ventas por chat y en Mercado Libre, junto a tu stock",
    lead: "Atiende pedidos por WhatsApp con enlace directo al chat de cada cliente y sincroniza tus publicaciones y órdenes de Mercado Libre en un solo lugar.",
    metaTitle: "WhatsApp y Mercado Libre en tu inventario — Cendaro",
    metaDescription:
      "Centraliza tus pedidos de WhatsApp con enlace directo al chat del cliente y gestiona publicaciones y órdenes de Mercado Libre junto a tu stock.",
    steps: [
      {
        title: "Registra el pedido del canal WhatsApp",
        text: "Filtra y crea pedidos originados por WhatsApp viendo el total en dólares y su equivalente en bolívares a la tasa BCV del día.",
        source: WHATSAPP_CLIENT,
      },
      {
        title: "Abre el chat con el resumen listo",
        text: "Con un clic abres la conversación de WhatsApp del cliente con su número de pedido y el monto listo para enviar.",
        source: WHATSAPP_CLIENT,
      },
      {
        title: "Vincula tus publicaciones de Mercado Libre",
        text: "Consulta tus publicaciones activas o pausadas, precios y existencias sincronizadas junto al resto de tu catálogo.",
        source: MARKETPLACE_CLIENT,
      },
      {
        title: "Importa las órdenes a tu operación",
        text: "Revisa las ventas de Mercado Libre y su estado de envío para despacharlas desde el mismo flujo de pedidos e inventario.",
        source: INTEGRATIONS,
      },
    ],
    capabilities: [
      { text: "Canal de pedidos por WhatsApp", source: WHATSAPP_CLIENT },
      { text: "Enlace directo wa.me con el pedido", source: WHATSAPP_CLIENT },
      {
        text: "Publicaciones de Mercado Libre",
        source: MARKETPLACE_CLIENT,
      },
      { text: "Órdenes y estado de envío", source: MARKETPLACE_CLIENT },
      { text: "Asignación de stock por canal", source: SALES },
      { text: "Totales en USD y bolívares BCV", source: WHATSAPP_CLIENT },
    ],
    difference: {
      title: "Ningún pedido se queda perdido en un teléfono",
      body: "Aunque cierres la venta por chat o por Mercado Libre, el pedido queda registrado con su cliente, su stock reservado y su cuenta por cobrar.",
    },
    modules: ["whatsapp", "marketplace", "orders", "inventory"],
    faq: [
      {
        q: "¿Cómo funciona la conexión con WhatsApp?",
        a: "Registra los pedidos del canal WhatsApp y genera enlaces directos (wa.me) hacia el teléfono del cliente con los datos del pedido listos para enviar, sin requerir configuraciones complejas.",
        source: WHATSAPP_CLIENT,
      },
      {
        q: "¿Qué veo en el módulo de Mercado Libre?",
        a: "Ves tus publicaciones con su estado y stock sincronizado, las órdenes recibidas con el estado de envío y el registro de sincronizaciones.",
        source: MARKETPLACE_CLIENT,
      },
      {
        q: "¿Puedo separar el stock por canal?",
        a: "Sí. El inventario permite asignar existencias por almacén y por canal de venta para no vender dos veces el mismo producto.",
        source: INVENTORY,
      },
    ],
  },

  "seguridad-y-control": {
    slug: "seguridad-y-control",
    name: "Seguridad, roles y auditoría",
    eyebrow: "Control y permisos",
    title: "Cada quien en su rol, cada cambio en la auditoría",
    lead: "Datos aislados por empresa en la base de datos, seis roles verificados en el servidor, acceso con segundo factor y trazabilidad de cada operación.",
    metaTitle: "Roles, permisos, auditoría y seguridad — Cendaro",
    metaDescription:
      "Datos aislados por empresa, seis roles con permisos por acción, verificación en dos pasos (TOTP) y registro de auditoría de cada movimiento.",
    steps: [
      {
        title: "Asigna uno de los seis roles a cada miembro",
        text: "Dueño, administrador, supervisor, empleado, vendedor o marketing: cada rol define qué módulos puede ver y qué acciones puede ejecutar.",
        source: AUTHZ,
      },
      {
        title: "Activa la verificación en dos pasos",
        text: "Cada usuario protege su cuenta con una aplicación autenticadora (TOTP), exigida para operaciones sensibles.",
        source: SECURITY_SETTINGS,
      },
      {
        title: "Opera con aislamiento por empresa",
        text: "Las políticas de seguridad de la base de datos garantizan que cada consulta y escritura ocurra únicamente dentro de tu empresa.",
        source: ISOLATION,
      },
      {
        title: "Audita quién cambió qué y cuándo",
        text: "Precios, tasas, conteos, cierres de caja y permisos quedan asentados en un registro de auditoría verificable.",
        source: AUDIT,
      },
    ],
    capabilities: [
      { text: `${FACTS.roles} roles con permisos por acción`, source: AUTHZ },
      { text: "Aislamiento por empresa en base de datos", source: ISOLATION },
      {
        text: "Verificación en dos pasos (TOTP)",
        source: SECURITY_SETTINGS,
      },
      { text: "Cierre de sesión tras 30 min inactivo", source: PROXY },
      { text: "Bloqueo ante intentos fallidos", source: LOGIN_ROUTE },
      { text: "Registro de auditoría encadenado", source: AUDIT },
    ],
    difference: {
      title: "Delegas la operación sin entregar las llaves",
      body: "El cajero cobra, el almacenista cuenta y el vendedor toma pedidos, mientras las aprobaciones de tasas, precios y contenedores quedan bajo tu control.",
    },
    modules: ["users", "audit", "settings", "dashboard"],
    faq: [
      {
        q: "¿Qué roles incluye Cendaro?",
        a: `Incluye ${FACTS.roles} roles: dueño, administrador, supervisor, empleado, vendedor y marketing. Cada permiso se verifica en el servidor antes de ejecutar cualquier acción.`,
        source: AUTHZ,
      },
      {
        q: "¿Qué pasa si alguien deja una sesión abierta?",
        a: "La sesión se cierra automáticamente tras 30 minutos sin actividad, tanto en el navegador como en el servidor.",
        source: PROXY,
      },
      {
        q: "¿Se puede borrar o alterar el historial de auditoría?",
        a: "No. El registro de auditoría encadena criptográficamente cada evento para que cualquier intento de alteración sea detectable.",
        source: AUDIT,
      },
    ],
  },
};

export const FEATURE_SLUGS = Object.keys(FEATURES) as readonly FeatureSlug[];

export const isFeatureSlug = (slug: string): slug is FeatureSlug =>
  Object.hasOwn(FEATURES, slug);

/** Feature page that explains a module, for links from grids and indexes. */
export const MODULE_FEATURE: Partial<Record<ErpModule, FeatureSlug>> = {
  catalog: "inventario",
  inventory: "inventario",
  containers: "importaciones",
  rates: "finanzas",
  pricing: "finanzas",
  payments: "finanzas",
  receivables: "finanzas",
  cash_closure: "finanzas",
  pos: "ventas-y-pos",
  orders: "ventas-y-pos",
  customers: "ventas-y-pos",
  vendors: "ventas-y-pos",
  whatsapp: "canales",
  marketplace: "canales",
  dashboard: "seguridad-y-control",
  users: "seguridad-y-control",
  audit: "seguridad-y-control",
  settings: "seguridad-y-control",
};

export const featureHref = (slug: FeatureSlug): string => `/funciones/${slug}`;

/** Recording shown in the product frame of each feature page. */
export const FEATURE_CLIP = {
  inventario: "flow-inventory-stock",
  importaciones: "flow-container-ai",
  finanzas: "flow-rates-bcv",
  "ventas-y-pos": "flow-orders-sale",
  canales: "flow-catalog-import",
  "seguridad-y-control": "flow-receivables-close",
} as const satisfies Record<FeatureSlug, keyof typeof CLIP_LABELS>;

/** Every factual statement on the feature pages, for the truth guard. */
export const FEATURE_CLAIMS: readonly Claim[] = Object.values(FEATURES).flatMap(
  (page) => [
    ...page.steps,
    ...page.capabilities,
    ...page.faq.map(({ a, source }) => ({ text: a, source })),
  ],
);
