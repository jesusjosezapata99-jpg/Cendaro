/**
 * Storyboards for the landing recordings (PLAN-2026-09-LANDING-REDESIGN F3).
 *
 * Each clip starts and ends on the same screen so the `<video loop>` restarts
 * without a visible jump. Everything runs against the fictitious demo
 * workspace ("Distribuidora Aurora") and never submits a form: imports stop
 * before committing, dialogs are closed, filters are cleared.
 *
 * `run(stage, ctx)` receives the Stage (lib/stage.mjs) and a context with the
 * demo product ids (needed to answer the AI endpoint).
 */
import { CONTAINER_ITEMS } from "./demo-data.mjs";
import {
  CATALOG_PATH,
  PACKING_LIST_PATH,
  XLSX_MIME,
} from "./make-fixtures.mjs";

const CATEGORY_BY_PREFIX = {
  LIM: "Limpieza",
  HOG: "Hogar y cocina",
  FER: "Ferretería",
  CUI: "Cuidado personal",
  PAP: "Papelería",
};

/**
 * What POST /api/ai/parse-packing-list answers for the demo packing list.
 * The endpoint needs a valid GROQ_API_KEY, which the local environment lacks
 * (401), so the recording answers it with the same shape the route returns.
 */
function packingListResponse(ctx) {
  const items = CONTAINER_ITEMS.map(
    ([english, spanish, sku, quantity, unitCost, , match]) => {
      const matched = sku !== null;
      return {
        original_name: english,
        name_es: spanish,
        quantity,
        unit_cost: unitCost,
        weight_kg: null,
        sku_hint: matched ? sku : null,
        category_hint: matched
          ? (CATEGORY_BY_PREFIX[sku.slice(0, 3)] ?? null)
          : "Hogar y cocina",
        confidence: matched ? Math.round(90 + match * 8) : 74,
        suggested_product_id: matched
          ? (ctx.productIdBySku[sku] ?? null)
          : null,
        match_type: matched ? "name_similarity" : "no_match",
        match_confidence: matched ? Math.round(match * 100) : 0,
        image_url: null,
        image_description: null,
      };
    },
  );
  const matchedCount = items.filter((i) => i.match_type !== "no_match").length;
  return {
    success: true,
    containerId: "",
    totalRows: 17,
    totalChunks: 1,
    failedChunks: [],
    itemCount: items.length,
    items,
    stats: {
      matched: matchedCount,
      review: 0,
      newItems: items.length - matchedCount,
      highConfidence: items.filter((i) => i.confidence >= 90).length,
      mediumConfidence: items.filter(
        (i) => i.confidence >= 60 && i.confidence < 90,
      ).length,
      lowConfidence: 0,
      imagesExtracted: 0,
      imagesAnalyzed: 0,
    },
    promptSource: "database",
  };
}

export const STORYBOARDS = [
  {
    id: "hero-overview",
    start: "/dashboard",
    label:
      "Panel de Cendaro con ventas, cuentas por cobrar y stock bajo, y la búsqueda global encontrando un cliente",
    posterAt: 0.62,
    async run(s) {
      await s.cutUntil({ text: "Utilidad Bruta" });
      await s.pause(800);
      await s.hover({ text: "Utilidad Bruta" }, { ms: 600 });
      await s.pause(400);
      await s.click({ text: "Buscar cualquier cosa" });
      await s.pause(400);
      await s.type("Supermercado", { cps: 10 });
      await s.cutUntil({ text: "Supermercado San Diego" });
      await s.pause(600);
      await s.hover({ text: "Supermercado San Diego" }, { ms: 700 });
      await s.pause(800);
      await s.key("Escape");
      await s.pause(500);
      await s.move({ x: 980, y: 560 }, { ms: 600 });
    },
  },
  {
    id: "flow-catalog-import",
    start: "/catalog/import",
    label:
      "Asistente de importación: sube un Excel, reconoce las columnas, valida cada fila y sugiere categorías",
    posterAt: 0.72,
    async run(s) {
      await s.cut(() => s.waitIdle());
      await s.pause(500);
      await s.attach("input[type=file]", CATALOG_PATH, XLSX_MIME);
      await s.cutUntil({ text: "Confirmar Mapeo" });
      await s.pause(1100);
      await s.click({ text: "Confirmar Mapeo" });
      await s.cutUntil({ text: "Continuar con" });
      await s.pause(800);
      await s.hover({ text: "Errores", tag: "div,button" }, { ms: 600 });
      await s.pause(600);
      await s.click({ text: "Continuar con" });
      await s.cutUntil({ text: "Resolver categorías" });
      await s.pause(800);
      await s.click({ text: "Saltar" });
      await s.pause(800);
      await s.click({ text: "Continuar al resumen" });
      await s.cutUntil({ text: "Resumen de importación" });
      await s.pause(1400);
      await s.hover({ text: "Productos nuevos" }, { ms: 600 });
      await s.pause(800);
      // Clean off-camera reset so the loop restarts seamlessly at dropzone
      await s.cut(async () => {
        await s.goto("/catalog/import", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
  {
    id: "flow-container-ai",
    start: "/containers",
    label:
      "Contenedor en tránsito: se sube el packing list del proveedor y la IA lista productos, cantidades y costos emparejados con el catálogo",
    posterAt: 0.7,
    async prepare(s, ctx) {
      await s.stub("*/api/ai/parse-packing-list*", {
        body: packingListResponse(ctx),
        delayMs: 1800,
      });
    },
    async run(s) {
      await s.cutUntil({ text: "MSKU 4829137" });
      await s.pause(400);
      await s.click({ text: "MSKU 4829137" });
      await s.cutUntil({ text: "PACKING LIST INTELIGENTE" });
      await s.pause(700);
      await s.hover(
        { text: "Arrastra el archivo de Packing List" },
        { ms: 600 },
      );
      await s.pause(400);
      await s.attach("input[type=file]", PACKING_LIST_PATH, XLSX_MIME);
      await s.cutUntil({ text: "Ítems Extraídos" });
      await s.pause(1100);
      await s.scroll(450, { ms: 1100 });
      await s.pause(900);
      await s.hover({ text: "Juego de ollas de aluminio" }, { ms: 600 });
      await s.pause(600);
      await s.scroll(0, { ms: 800 });
      await s.pause(400);
      await s.hover({ text: "Confirmar e Importar al Sistema" }, { ms: 700 });
      await s.pause(900);
      // Clean off-camera reset back to containers list
      await s.cut(async () => {
        await s.goto("/containers", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
  {
    id: "flow-orders-sale",
    start: "/orders",
    label:
      "Pedidos: búsqueda por cliente, detalle con totales en dólares y bolívares y cambio de estado",
    posterAt: 0.6,
    async run(s) {
      await s.cutUntil('input[placeholder^="Buscar por número"]');
      await s.pause(500);
      await s.click('input[placeholder^="Buscar por número"]');
      await s.type("Supermercado", { cps: 10 });
      await s.cutUntil({ text: "OC-1034" });
      await s.pause(600);
      await s.click({ text: "OC-1034" });
      await s.cutUntil({ text: "Cambiar estado" });
      await s.pause(900);
      await s.scroll(360, { ms: 900 });
      await s.pause(600);
      await s.scroll(0, { ms: 700 });
      await s.click({ text: "Cambiar estado" });
      await s.cutUntil({ text: "Cambiar Estado del Pedido" });
      await s.pause(600);
      await s.hover({ text: "Nuevo Estado" }, { ms: 500 });
      await s.pause(800);
      await s.hover({ text: "Cambiar Estado", tag: "button" }, { ms: 600 });
      await s.pause(800);
      // Clean off-camera reset back to orders list
      await s.cut(async () => {
        await s.goto("/orders", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
  {
    id: "flow-receivables-close",
    start: "/accounts-receivable",
    label:
      "Cuentas por cobrar con antigüedad y registro de un abono con su equivalente en bolívares",
    posterAt: 0.55,
    async run(s) {
      await s.cutUntil({ text: "Pendientes", tag: "button", nth: 0 });
      await s.pause(700);
      await s.click({ text: "Pendientes", tag: "button", nth: 0 });
      await s.pause(900);
      await s.click({ text: "Abonar", tag: "button", nth: 0 });
      await s.cutUntil({ text: "Registrar Abono a Cuenta" });
      await s.pause(700);
      await s.click({ text: "Abonar saldo total" });
      await s.cutUntil({ text: "Conversión BCV:" });
      await s.pause(800);
      await s.hover({ text: "Conversión BCV:" }, { ms: 600 });
      await s.pause(700);
      await s.hover({ text: "Registrar Abono", tag: "button" }, { ms: 600 });
      await s.pause(900);
      // Clean off-camera reset back to accounts-receivable
      await s.cut(async () => {
        await s.goto("/accounts-receivable", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
  {
    id: "flow-inventory-stock",
    start: "/inventory",
    label: "Inventario por almacén y canal, con filtro de stock bajo y agotado",
    posterAt: 0.55,
    async run(s) {
      await s.cutUntil({ text: "Filtros" });
      await s.pause(800);
      await s.click({ text: "Filtros" });
      await s.pause(500);
      await s.click({ text: "Stock Bajo", tag: "label,div,span" });
      await s.pause(700);
      await s.key("Escape");
      await s.pause(600);
      await s.scroll(320, { ms: 1100 });
      await s.pause(1000);
      await s.hover({ text: "Almacén Central", tag: "span,td,div", nth: 0 }, { ms: 600 });
      await s.pause(800);
      await s.scroll(0, { ms: 800 });
      // Clean off-camera reset back to inventory
      await s.cut(async () => {
        await s.goto("/inventory", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
  {
    id: "flow-rates-bcv",
    start: "/rates",
    label:
      "Tasas de cambio: BCV, paralelo y USD/CNY, brecha cambiaria, calculadora multi-moneda e historial",
    posterAt: 0.55,
    async run(s) {
      await s.cutUntil({ text: "Brecha cambiaria" });
      await s.pause(800);
      await s.hover({ text: "Brecha cambiaria" }, { ms: 600 });
      await s.pause(500);
      await s.click("input[type=number]");
      await s.key("a", { ctrl: true });
      await s.type("250", { cps: 7 });
      await s.pause(900);
      await s.waitFor('button[aria-label="Invertir monedas"]');
      await s.click('button[aria-label="Invertir monedas"]');
      await s.pause(1000);
      await s.scroll(520, { ms: 1000 });
      await s.pause(600);
      await s.click({ text: "BCV", tag: "button", nth: 0 });
      await s.pause(900);
      await s.click({ text: "Todas", tag: "button", nth: 0 });
      await s.pause(700);
      await s.scroll(0, { ms: 800 });
      // Clean off-camera reset
      await s.cut(async () => {
        await s.goto("/rates", { settle: 300 });
        await s.waitIdle();
      });
      await s.pause(300);
    },
  },
];
