/**
 * Cendaro — Zero-Template Tabular Schema Mapper & Deterministic Row Compiler
 *
 * Implements the 3-tier schema resolution pipeline for `.xlsx`, `.xls`, and `.csv`
 * files across `catalog`, `inventory`, and `packing_list` domains:
 *   • Tier 0: Saved tenant/supplier `ImportTemplateProfile` lookup (`0 ms`, `0` tokens).
 *   • Tier 1: Multilingual deterministic alias scanner (`ES` / `EN` / `ZH` / `PT`).
 *   • Tier 2: Gemini Free-Tier sample inference (`headers` + up to 5 format-masked
 *             sample rows — confidential numbers replaced by format shapes `$00.00`
 *             so exact supplier prices never leave Cendaro!).
 *   • Deterministic Row Compiler (`compileTabularRowsDeterministically`): transforms
 *             up to `10,000` raw rows locally with `roundMoney2` precision, footer
 *             filtering, box-multiplier math, and editable SKU autogeneration.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import type {
  CanonicalImportField,
  ColumnIndexMapping,
  ImportCurrency,
  ImportTargetDomain,
  InferredTabularSchemaResult,
  TabularSchemaInferenceInput,
  TabularTransformRules,
} from "@cendaro/validators";
import { ImportTemplateProfile } from "@cendaro/db/schema";
import {
  CANONICAL_IMPORT_FIELDS,
  compileTabularRowsDeterministically,
  computeHeaderFingerprint,
  normalizeImportHeaderToken,
  parseLocalizedNumericCell,
  tabularTransformRulesSchema,
} from "@cendaro/validators";

import type { GeminiJsonSchema } from "./gemini-structured";
import {
  generateStructuredJson,
  isGenerativeAiConfigured,
} from "./gemini-structured";

// ──────────────────────────────────────────────
// Multilingual Deterministic Header Dictionary
// ──────────────────────────────────────────────

const MULTILINGUAL_HEADER_ALIASES: Readonly<
  Record<string, CanonicalImportField>
> = {
  // SKU / Reference
  sku: "sku",
  ref: "sku",
  referencia: "sku",
  reference: "sku",
  codigo: "sku",
  code: "sku",
  "internal code": "sku",
  "codigo interno": "sku",
  "item code": "sku",
  "item no": "sku",
  "item number": "sku",
  "part no": "sku",
  "part number": "sku",
  "model no": "sku",
  modelo: "sku",
  art: "sku",
  articulo: "sku",
  cod: "sku",
  "cod prod": "sku",
  "cod producto": "sku",
  编号: "sku",
  货号: "sku",
  型号: "sku",
  编码: "sku",

  // Name / Product Title
  name: "name",
  nombre: "name",
  "product name": "name",
  product: "name",
  producto: "name",
  "nombre del producto": "name",
  "nombre producto": "name",
  item: "name",
  "item name": "name",
  "goods description": "name",
  mercancia: "name",
  "descripcion del producto": "name",
  品名: "name",
  产品名称: "name",
  商品名: "name",
  货物名称: "name",

  // Barcode / GTIN / EAN
  barcode: "barcode",
  "bar code": "barcode",
  ean: "barcode",
  ean13: "barcode",
  upc: "barcode",
  gtin: "barcode",
  "codigo de barras": "barcode",
  条码: "barcode",
  条形码: "barcode",

  // Category
  category: "category",
  categoria: "category",
  cat: "category",
  "product category": "category",
  rubro: "category",
  linea: "category",
  departamento: "category",
  familia: "category",
  类别: "category",
  分类: "category",
  类目: "category",

  // Brand
  brand: "brand",
  marca: "brand",
  "brand name": "brand",
  fabricante: "brand",
  品牌: "brand",

  // Cost / Unit Price
  cost: "cost",
  costo: "cost",
  "unit cost": "cost",
  precio: "cost",
  "precio unitario": "cost",
  "costo unitario": "cost",
  "unit price": "cost",
  price: "cost",
  fob: "cost",
  "fob price": "cost",
  "exw price": "cost",
  "p unit": "cost",
  "valor unitario": "cost",
  单价: "cost",
  价格: "cost",
  出厂价: "cost",

  // Direct Quantity
  quantity: "quantity",
  qty: "quantity",
  cantidad: "quantity",
  cant: "quantity",
  units: "quantity",
  unidades: "quantity",
  "total units": "quantity",
  "total unidades": "quantity",
  pcs: "quantity",
  pieces: "quantity",
  existencia: "quantity",
  stock: "quantity",
  conteo: "quantity",
  数量: "quantity",
  总数量: "quantity",

  // Packaging Hierarchy (Bultos / Master Cartons / Inner Boxes)
  bultos: "bultos",
  bulto: "bultos",
  ctns: "bultos",
  ctn: "bultos",
  cartons: "bultos",
  "master cartons": "bultos",
  箱数: "bultos",
  件数: "bultos",
  "cajas por bulto": "cajasPerBulk",
  "cajas x bulto": "cajasPerBulk",
  "inner boxes": "cajasPerBulk",
  "boxes per carton": "cajasPerBulk",
  "unidades por caja": "unidPerCaja",
  "unid x caja": "unidPerCaja",
  "unid por caja": "unidPerCaja",
  "pcs ctn": "unidPerCaja",
  "qty ctn": "unidPerCaja",
  "units per box": "unidPerCaja",
  装箱数: "unidPerCaja",
  每箱数量: "unidPerCaja",
  presentacion: "presentacion",
  pack: "presentacion",

  // Weight & Volume
  weight: "weight",
  peso: "weight",
  "weight kg": "weight",
  "peso kg": "weight",
  "gross weight": "weight",
  "net weight": "weight",
  gw: "weight",
  nw: "weight",
  重量: "weight",
  毛重: "weight",
  净重: "weight",
  volume: "volume",
  volumen: "volume",
  cbm: "volume",
  "cubic meters": "volume",
  m3: "volume",
  体积: "volume",

  // Description / Notes
  description: "description",
  descripcion: "description",
  notes: "description",
  notas: "description",
  observaciones: "description",
  comentarios: "description",
  specification: "description",
  especificacion: "description",
  备注: "description",
  说明: "description",
  规格: "description",
};

const DEFAULT_SUMMARY_KEYWORDS = [
  "total",
  "subtotal",
  "sub-total",
  "grand total",
  "total general",
  "合计",
  "总计",
  "小计",
];

function isUndefinedTableError(err: unknown): boolean {
  const code =
    (err as { code?: string } | null)?.code ??
    (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "42P01";
}

function detectCurrencyFromSamples(
  headers: readonly string[],
  sampleDataRows: readonly string[][],
): ImportCurrency {
  const joined = [
    ...headers,
    ...sampleDataRows.flatMap((r) => r.slice(0, 20)),
  ].join(" ");
  if (/(?:\bCNY\b|\bRMB\b|¥|￥)/i.test(joined)) return "CNY";
  if (/(?:\bEUR\b|€)/i.test(joined)) return "EUR";
  if (/(?:\bVES\b|\bBs\.?\b)/i.test(joined)) return "VES";
  return "USD";
}

function detectDecimalSeparator(
  sampleDataRows: readonly string[][],
): "." | "," {
  let commaDecimalHits = 0;
  let dotDecimalHits = 0;
  for (const row of sampleDataRows) {
    for (const cell of row) {
      const s = cell.trim();
      if (/^\d{1,3}(?:\.\d{3})+,\d{1,4}$/.test(s) || /^\d+,\d{2}$/.test(s)) {
        commaDecimalHits++;
      } else if (
        /^\d{1,3}(?:,\d{3})+\.\d{1,4}$/.test(s) ||
        /^\d+\.\d{2}$/.test(s)
      ) {
        dotDecimalHits++;
      }
    }
  }
  return commaDecimalHits > dotDecimalHits ? "," : ".";
}

/**
 * Replaces exact digits in sample data cells with `0` (except row indices and short integers)
 * while preserving currency symbols, punctuation, decimal separators, and SKU prefixes,
 * guaranteeing confidential supplier prices never leave Cendaro during schema inference.
 */
export function maskSampleCellForSchemaInference(
  cell: string,
  colIndex: number,
): string {
  const trimmed = String(cell).trim().slice(0, 120);
  if (trimmed.length === 0) return "";
  // Preserve alphanumeric SKU-like codes (contain letters + digits without currency signs)
  const hasCurrency = /[$€¥￥]|\b(?:USD|CNY|RMB|EUR|VES|Bs)\b/i.test(trimmed);
  const isPurePriceOrDecimal =
    hasCurrency || /^[+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,4})$/.test(trimmed);
  if (isPurePriceOrDecimal && colIndex > 0) {
    return trimmed.replace(/\d/g, "0");
  }
  return trimmed;
}

export function scanDeterministicHeaderMapping(
  sampleRows: readonly string[][],
  targetDomain: ImportTargetDomain,
): {
  bestRowIndex: number;
  headers: string[];
  mapping: ColumnIndexMapping;
  unmapped: string[];
  coverageRatio: number;
  satisfiesDomain: boolean;
} {
  let bestRowIndex = 0;
  let bestHeaders: string[] = sampleRows[0] ?? [];
  let bestMapping: ColumnIndexMapping = {};
  let bestUnmapped: string[] = [];
  let bestScore = -1;

  const scanLimit = Math.min(sampleRows.length, 25);
  for (let r = 0; r < scanLimit; r++) {
    const row = sampleRows[r] ?? [];
    const nonEmptyCount = row.filter((c) => String(c).trim().length > 0).length;
    if (nonEmptyCount < 2) continue;

    const mapping: ColumnIndexMapping = {};
    const unmapped: string[] = [];

    for (let c = 0; c < row.length; c++) {
      const rawHeader = String(row[c] ?? "").trim();
      if (!rawHeader) continue;
      const norm = normalizeImportHeaderToken(rawHeader);
      let matched = MULTILINGUAL_HEADER_ALIASES[norm];

      // Secondary fallback: if `description` matched and `name` hasn't been mapped yet, promote to `name`
      if (matched === "description" && mapping.name === undefined) {
        matched = "name";
      }

      if (matched && mapping[matched] === undefined) {
        mapping[matched] = c;
      } else {
        unmapped.push(rawHeader);
      }
    }

    const mappedCount = Object.keys(mapping).length;
    // Bonus for having core domain fields
    const hasNameOrSku =
      mapping.name !== undefined || mapping.sku !== undefined ? 2 : 0;
    const score = mappedCount * 2 + hasNameOrSku;
    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
      bestHeaders = row.map((cell) => String(cell));
      bestMapping = mapping;
      bestUnmapped = unmapped;
    }
  }

  const nonEmptyTotal = Math.max(
    1,
    bestHeaders.filter((h) => h.trim().length > 0).length,
  );
  const mappedTotal = Object.keys(bestMapping).length;
  const coverageRatio =
    Math.trunc((mappedTotal / nonEmptyTotal) * 10_000) / 10_000;

  const hasPackagingTriplet =
    bestMapping.bultos !== undefined && bestMapping.unidPerCaja !== undefined;

  const satisfiesDomain =
    targetDomain === "catalog"
      ? bestMapping.name !== undefined &&
        (bestMapping.sku !== undefined || mappedTotal >= 3)
      : targetDomain === "inventory"
        ? (bestMapping.sku !== undefined || bestMapping.name !== undefined) &&
          (bestMapping.quantity !== undefined || hasPackagingTriplet)
        : bestMapping.name !== undefined &&
          (bestMapping.quantity !== undefined || hasPackagingTriplet);

  return {
    bestRowIndex,
    headers: bestHeaders,
    mapping: bestMapping,
    unmapped: bestUnmapped,
    coverageRatio,
    satisfiesDomain,
  };
}

/**
 * Looks up a previously saved `ImportTemplateProfile` in the current workspace
 * across candidate header rows in `sampleRows`. Gracefully returns `null` if
 * migration `037` has not yet been applied (`42P01`).
 */
export async function lookupSavedTemplateProfile(
  tx: NodePgDatabase<Record<string, unknown>>,
  workspaceId: string,
  targetDomain: ImportTargetDomain,
  sampleRows: readonly string[][],
  supplierId?: string,
): Promise<{
  profileId: string;
  profileName: string;
  headerRowIndex: number;
  headerFingerprint: string;
  detectedHeaders: string[];
  columnMapping: ColumnIndexMapping;
  transformRules: TabularTransformRules;
} | null> {
  const candidates: {
    rowIndex: number;
    fingerprint: string;
    headers: string[];
  }[] = [];
  const maxScan = Math.min(sampleRows.length, 25);

  for (let i = 0; i < maxScan; i++) {
    const row = sampleRows[i] ?? [];
    const nonEmpty = row.filter((c) => String(c).trim().length > 0).length;
    if (nonEmpty < 2) continue;
    const headers = row.map((c) => String(c));
    const fp = computeHeaderFingerprint(headers);
    if (fp !== "0".repeat(64)) {
      candidates.push({ rowIndex: i, fingerprint: fp, headers });
    }
  }

  if (candidates.length === 0) return null;

  try {
    const fingerprints = Array.from(
      new Set(candidates.map((c) => c.fingerprint)),
    );
    const profiles = await tx
      .select()
      .from(ImportTemplateProfile)
      .where(
        and(
          eq(ImportTemplateProfile.workspaceId, workspaceId),
          eq(ImportTemplateProfile.targetDomain, targetDomain),
          inArray(ImportTemplateProfile.headerFingerprint, fingerprints),
        ),
      )
      .orderBy(desc(ImportTemplateProfile.hitCount));

    if (profiles.length === 0) return null;

    // Prefer supplier-specific profile if supplierId matches, otherwise highest hitCount
    const matchedProfile =
      (supplierId
        ? profiles.find((p) => p.supplierId === supplierId)
        : undefined) ?? profiles[0];
    if (!matchedProfile) return null;

    const matchingRow = candidates.find(
      (c) => c.fingerprint === matchedProfile.headerFingerprint,
    );
    if (!matchingRow) return null;

    const rawMap = (matchedProfile.columnMapping ?? {}) as Record<
      string,
      unknown
    >;
    const cleanMapping: ColumnIndexMapping = {};
    for (const field of CANONICAL_IMPORT_FIELDS) {
      const idx = rawMap[field];
      if (
        typeof idx === "number" &&
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < matchingRow.headers.length
      ) {
        cleanMapping[field] = idx;
      }
    }

    const parsedRules = tabularTransformRulesSchema.safeParse(
      matchedProfile.transformRules ?? {},
    );

    return {
      profileId: matchedProfile.id,
      profileName: matchedProfile.profileName,
      headerRowIndex: matchingRow.rowIndex,
      headerFingerprint: matchedProfile.headerFingerprint,
      detectedHeaders: matchingRow.headers,
      columnMapping: cleanMapping,
      transformRules: parsedRules.success
        ? parsedRules.data
        : {
            currency: "USD",
            decimalSeparator: ".",
            unitsFormula: "direct_quantity",
            skuAutoGenerate: cleanMapping.sku === undefined,
          },
    };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return null;
    }
    throw err;
  }
}

const aiTabularInferenceZodSchema = z.object({
  headerRowIndex: z.int().min(0).max(29),
  mappings: z
    .array(
      z.object({
        field: z.enum(CANONICAL_IMPORT_FIELDS),
        columnIndex: z.int().min(0).max(200),
      }),
    )
    .max(30),
  currency: z.enum(["USD", "CNY", "EUR", "VES"]).default("USD"),
  decimalSeparator: z.enum([".", ","]).default("."),
  unitsFormula: z
    .enum(["direct_quantity", "bultos_x_cajas_x_unid"])
    .default("direct_quantity"),
  confidence: z.number().min(0).max(1).default(0.88),
  warnings: z.array(z.string().max(300)).max(10).default([]),
});

const AI_TABULAR_GEMINI_SCHEMA: GeminiJsonSchema = {
  type: "OBJECT",
  properties: {
    headerRowIndex: {
      type: "INTEGER",
      description: "0-based row index containing the column headers",
    },
    mappings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          field: {
            type: "STRING",
            enum: [...CANONICAL_IMPORT_FIELDS],
          },
          columnIndex: {
            type: "INTEGER",
          },
        },
        required: ["field", "columnIndex"],
      },
    },
    currency: {
      type: "STRING",
      enum: ["USD", "CNY", "EUR", "VES"],
    },
    decimalSeparator: {
      type: "STRING",
      enum: [".", ","],
    },
    unitsFormula: {
      type: "STRING",
      enum: ["direct_quantity", "bultos_x_cajas_x_unid"],
    },
    confidence: {
      type: "NUMBER",
    },
    warnings: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: [
    "headerRowIndex",
    "mappings",
    "currency",
    "decimalSeparator",
    "unitsFormula",
    "confidence",
  ],
};

/**
 * Resolves the complete schema & transformation contract for any uploaded spreadsheet
 * sheet, using saved `ImportTemplateProfile` -> Deterministic Alias -> Gemini Free-Tier AI.
 *
 * IMPORTANT: Call `lookupSavedTemplateProfile` inside a short read-only transaction FIRST,
 * and call `inferTabularSchema` OUTSIDE any DB transaction so Supavisor `:6543` connections
 * are never held open during external Gemini I/O.
 */
export async function inferTabularSchema(params: {
  workspaceId: string;
  userId?: string | null;
  input: TabularSchemaInferenceInput;
  savedProfile?: Awaited<ReturnType<typeof lookupSavedTemplateProfile>>;
  poolDb?: ReturnType<typeof getDb>;
}): Promise<InferredTabularSchemaResult> {
  const { input, savedProfile } = params;

  // Tier 0: Exact saved tenant/supplier template profile hit (0ms, 0 LLM calls)
  if (savedProfile) {
    const mappedIndices = new Set(Object.values(savedProfile.columnMapping));
    const unmappedHeaders = savedProfile.detectedHeaders.filter(
      (h, idx) => h.trim().length > 0 && !mappedIndices.has(idx),
    );
    return {
      targetDomain: input.targetDomain,
      headerRowIndex: savedProfile.headerRowIndex,
      ignoreSummaryKeywords: DEFAULT_SUMMARY_KEYWORDS,
      headerFingerprint: savedProfile.headerFingerprint,
      detectedHeaders: savedProfile.detectedHeaders,
      columnMapping: savedProfile.columnMapping,
      unmappedHeaders,
      transformRules: savedProfile.transformRules,
      confidence: 0.99,
      source: "template_profile",
      matchedProfileId: savedProfile.profileId,
      matchedProfileName: savedProfile.profileName,
      warnings: [],
    };
  }

  // Tier 1: Deterministic multilingual alias scan
  const det = scanDeterministicHeaderMapping(
    input.sampleRows,
    input.targetDomain,
  );
  const sampleAfterHeader = input.sampleRows.slice(
    det.bestRowIndex + 1,
    det.bestRowIndex + 7,
  );
  const fallbackCurrency = detectCurrencyFromSamples(
    det.headers,
    sampleAfterHeader,
  );
  const fallbackDecimalSep = detectDecimalSeparator(sampleAfterHeader);
  const fallbackUnitsFormula =
    det.mapping.quantity === undefined &&
    det.mapping.bultos !== undefined &&
    det.mapping.unidPerCaja !== undefined
      ? "bultos_x_cajas_x_unid"
      : "direct_quantity";

  // Skip LLM call completely when deterministic alias scan confidently resolves the domain!
  const deterministicIsComplete =
    det.satisfiesDomain &&
    det.mapping.sku !== undefined &&
    det.coverageRatio >= 0.65;

  if (deterministicIsComplete || !isGenerativeAiConfigured()) {
    const warnings: string[] = [];
    if (det.mapping.sku === undefined) {
      warnings.push(
        "No se detectó columna de SKU; se sugerirán códigos editables automáticamente.",
      );
    }
    return {
      targetDomain: input.targetDomain,
      headerRowIndex: det.bestRowIndex,
      ignoreSummaryKeywords: DEFAULT_SUMMARY_KEYWORDS,
      headerFingerprint: computeHeaderFingerprint(det.headers),
      detectedHeaders: det.headers,
      columnMapping: det.mapping,
      unmappedHeaders: det.unmapped,
      transformRules: {
        currency: fallbackCurrency,
        decimalSeparator: fallbackDecimalSep,
        unitsFormula: fallbackUnitsFormula,
        skuAutoGenerate: det.mapping.sku === undefined,
      },
      confidence: deterministicIsComplete ? 0.95 : 0.62,
      source: "deterministic_alias",
      matchedProfileId: null,
      matchedProfileName: null,
      warnings,
    };
  }

  // Tier 2: Gemini Free-Tier Sample Inference (headers + max 6 format-masked sample rows)
  const previewSlice = input.sampleRows.slice(0, 18).map((row, rIdx) => ({
    rowIndex: rIdx,
    cells: row
      .slice(0, 35)
      .map(
        (cell, cIdx) =>
          `[${cIdx}] ${maskSampleCellForSchemaInference(cell, cIdx)}`,
      ),
  }));

  const systemInstruction = [
    "Eres un arquitecto experto en integración de datos ERP mayoristas e importaciones internacionales (Cendaro).",
    `Tu tarea es analizar las primeras filas de una hoja de cálculo subida para el dominio "${input.targetDomain}" y devolver EXCLUSIVAMENTE un objeto JSON con el mapeo exacto de índices de columna.`,
    "Campos canónicos disponibles:",
    "- sku: código interno, referencia, item no, part no, 货号",
    "- name: nombre del producto, descripción principal del artículo, 品名",
    "- barcode: código de barras EAN-13, UPC, GTIN",
    "- category: categoría, rubro, departamento, familia",
    "- brand: marca, fabricante, 品牌",
    "- cost: precio/costo unitario de compra o lista (FOB, EXW, P.Unit)",
    "- quantity: cantidad total de unidades directas (unidades, existencia, pcs, 数量)",
    "- bultos: cantidad de bultos / cajas máster (CTNS, 箱数)",
    "- cajasPerBulk: cajas internas por bulto",
    "- unidPerCaja: unidades por caja / PCS/CTN / 装箱数",
    "- presentacion: factor de presentación",
    "- weight: peso en kg (GW/NW)",
    "- volume: volumen en CBM / m3",
    "- description: notas técnicas secundarias (solo si ya existe otra columna para name)",
    "Reglas estrictas:",
    "1. Identifica headerRowIndex saltando filas iniciales de título, fecha, RIF o membrete.",
    "2. Asigna cada columnIndex (0-based) a lo sumo a UN campo canónico.",
    "3. Si existen columnas de bultos + unidades por caja y NO una columna de unidades totales directas, usa unitsFormula='bultos_x_cajas_x_unid'.",
  ].join("\n");

  try {
    const aiRes = await generateStructuredJson({
      workspaceId: params.workspaceId,
      userId: params.userId,
      operationLabel: `tabular_schema_infer:${input.targetDomain}`,
      systemInstruction,
      untrustedUserText: JSON.stringify(
        {
          filename: input.filename,
          sheetName: input.sheetName ?? "Sheet1",
          rows: previewSlice,
        },
        null,
        2,
      ),
      responseSchema: AI_TABULAR_GEMINI_SCHEMA,
      zodSchema: aiTabularInferenceZodSchema,
      poolDb: params.poolDb,
      timeoutMs: 11_000,
    });

    const headerIdx = Math.min(
      aiRes.data.headerRowIndex,
      input.sampleRows.length - 1,
    );
    const headerRow = (input.sampleRows[headerIdx] ?? []).map((c) => String(c));
    const columnMapping: ColumnIndexMapping = {};
    const usedCols = new Set<number>();

    for (const entry of aiRes.data.mappings) {
      if (
        entry.columnIndex >= 0 &&
        entry.columnIndex < headerRow.length &&
        columnMapping[entry.field] === undefined &&
        !usedCols.has(entry.columnIndex)
      ) {
        columnMapping[entry.field] = entry.columnIndex;
        usedCols.add(entry.columnIndex);
      }
    }

    // Backfill any obvious alias the LLM left unmapped
    const localHeaderCheck = scanDeterministicHeaderMapping(
      [headerRow],
      input.targetDomain,
    );
    for (const field of CANONICAL_IMPORT_FIELDS) {
      const colIdx = localHeaderCheck.mapping[field];
      if (
        colIdx !== undefined &&
        columnMapping[field] === undefined &&
        !usedCols.has(colIdx)
      ) {
        columnMapping[field] = colIdx;
        usedCols.add(colIdx);
      }
    }

    const unmappedHeaders = headerRow.filter(
      (h, idx) => h.trim().length > 0 && !usedCols.has(idx),
    );
    const warnings = [...aiRes.data.warnings];
    if (columnMapping.sku === undefined) {
      warnings.push(
        "El archivo no incluye columna de SKU; se generaron códigos sugeridos editables.",
      );
    }

    return {
      targetDomain: input.targetDomain,
      headerRowIndex: headerIdx,
      ignoreSummaryKeywords: DEFAULT_SUMMARY_KEYWORDS,
      headerFingerprint: computeHeaderFingerprint(headerRow),
      detectedHeaders: headerRow,
      columnMapping,
      unmappedHeaders,
      transformRules: {
        currency: aiRes.data.currency,
        decimalSeparator: aiRes.data.decimalSeparator,
        unitsFormula: aiRes.data.unitsFormula,
        skuAutoGenerate: columnMapping.sku === undefined,
      },
      confidence: Math.trunc(aiRes.data.confidence * 10_000) / 10_000,
      source: aiRes.provider === "gemini" ? "gemini_ai" : "groq_fallback",
      matchedProfileId: null,
      matchedProfileName: null,
      warnings,
    };
  } catch {
    // Graceful degradation to deterministic alias scan if external AI fails or times out
    const warnings = [
      "El servicio IA estuvo ocupado; se aplicó detección determinista de columnas.",
    ];
    if (det.mapping.sku === undefined) {
      warnings.push(
        "No se detectó columna de SKU; puedes asignarla manualmente o usar códigos sugeridos.",
      );
    }
    return {
      targetDomain: input.targetDomain,
      headerRowIndex: det.bestRowIndex,
      ignoreSummaryKeywords: DEFAULT_SUMMARY_KEYWORDS,
      headerFingerprint: computeHeaderFingerprint(det.headers),
      detectedHeaders: det.headers,
      columnMapping: det.mapping,
      unmappedHeaders: det.unmapped,
      transformRules: {
        currency: fallbackCurrency,
        decimalSeparator: fallbackDecimalSep,
        unitsFormula: fallbackUnitsFormula,
        skuAutoGenerate: det.mapping.sku === undefined,
      },
      confidence: det.satisfiesDomain ? 0.8 : 0.5,
      source: "deterministic_alias",
      matchedProfileId: null,
      matchedProfileName: null,
      warnings,
    };
  }
}

// ──────────────────────────────────────────────
// Deterministic Tabular Row Compiler (0 Hallucination)
// ──────────────────────────────────────────────

export { compileTabularRowsDeterministically, parseLocalizedNumericCell };
