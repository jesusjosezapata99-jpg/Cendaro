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

import type { Claim, FaqItem } from "./content";
import { FACTS } from "./content";

export type FeatureSlug = "inventario" | "importaciones" | "finanzas";

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
  payments: "finanzas",
  receivables: "finanzas",
  cash_closure: "finanzas",
};

export const featureHref = (slug: FeatureSlug): string => `/funciones/${slug}`;

/** Every factual statement on the feature pages, for the truth guard. */
export const FEATURE_CLAIMS: readonly Claim[] = Object.values(FEATURES).flatMap(
  (page) => [
    ...page.steps,
    ...page.capabilities,
    ...page.faq.map(({ a, source }) => ({ text: a, source })),
  ],
);
