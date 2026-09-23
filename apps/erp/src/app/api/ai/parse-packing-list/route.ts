import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import sharp from "sharp";
import { z } from "zod/v4";

import type { UserRole } from "@cendaro/validators";
import { isValidUuid, mapClaimsToUser } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";
import { and, desc, eq, sql } from "@cendaro/db";
import { getDb } from "@cendaro/db/client";
import {
  AiPromptConfig,
  Brand,
  Category,
  Container,
  Product,
} from "@cendaro/db/schema";
import { can } from "@cendaro/validators";

import { env } from "~/env";

// ── Types ──────────────────────────────────────────────
// AI-generated output is untrusted input (F8.4): validated with Zod right
// where the LLM's JSON response is parsed (callGroq, analyzeImagesWithVision)
// instead of blindly cast to a TypeScript interface.
const ParsedItemSchema = z.object({
  original_name: z.string(),
  name_es: z.string(),
  quantity: z.number(),
  unit_cost: z.number().nullable(),
  weight_kg: z.number().nullable(),
  sku_hint: z.string().nullable(),
  category_hint: z.string().nullable(),
  confidence: z.number(),
});
type ParsedItem = z.infer<typeof ParsedItemSchema>;

interface MatchedItem extends ParsedItem {
  suggested_product_id: string | null;
  match_type: "exact_sku" | "name_similarity" | "ai_only" | "no_match";
  match_confidence: number;
  image_url: string | null;
  image_description: string | null;
}

interface ExtractedImage {
  buffer: Buffer;
  index: number;
  fileName: string;
  mimeType: string;
}

const VisionResultSchema = z.object({
  index: z.number(),
  product_name_es: z.string(),
  visible_text: z.string(),
  category: z.string(),
  brand_visible: z.string().nullable(),
  material: z.string(),
  colors: z.array(z.string()),
  size_estimate: z.string(),
  packaging: z.string(),
  confidence: z.number(),
});
type VisionResult = z.infer<typeof VisionResultSchema>;

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: { message: { content: string } }[];
}

interface GroqVisionResponse {
  choices: { message: { content: string } }[];
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  categoryName: string | null;
  brandName: string | null;
}

// ── Config ─────────────────────────────────────────────
const PRIMARY_MODEL = "qwen/qwen3-32b";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const CHUNK_SIZE = 8; // Strict limit for Groq free tier (6K TPM — ~3K tokens per request)
const MAX_CONCURRENT = 1; // Serialize to respect 60 RPM
const INTER_CHUNK_DELAY_MS = 15000; // 15s delay between server-side chunks to respect TPM window
const MAX_RETRIES = 3;
const MAX_IMAGES_PER_VISION_REQUEST = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB for Groq base64 limit
const MAX_TOTAL_IMAGES = 20;
const _MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — reference for client-side validation
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// F8.3 — safe parsing limits (zip bombs / decompression bombs)
const MAX_ZIP_ENTRIES = 2000;
const MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB, summed across all decompressed entries
const MAX_SHEET_ROWS = 20_000;
const MAX_INPUT_PIXELS = 50_000_000; // sharp's decoded-pixel ceiling
const MAX_REQUEST_BYTES = 10 * 1024 * 1024; // matches the tRPC route's own DoS guard (L2)

/** Thrown when an uploaded file exceeds a decompression/size safety limit. */
class PayloadTooLargeError extends Error {}

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".pdf"] as const;
const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keeps only array entries that match ParsedItemSchema; drops the rest (the
 * LLM's JSON output is untrusted — F8.4) instead of trusting a blind cast. */
function parseItemsArray(value: unknown): ParsedItem[] {
  if (!Array.isArray(value)) return [];
  const items: ParsedItem[] = [];
  for (const entry of value) {
    const result = ParsedItemSchema.safeParse(entry);
    if (result.success) items.push(result.data);
  }
  return items;
}

// ── Levenshtein Distance ───────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use flat array to avoid non-null assertions on 2D array
  const dp = new Array<number>((m + 1) * (n + 1)).fill(0);
  const idx = (i: number, j: number) => i * (n + 1) + j;
  for (let i = 0; i <= m; i++) dp[idx(i, 0)] = i;
  for (let j = 0; j <= n; j++) dp[idx(0, j)] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[idx(i, j)] = Math.min(
        (dp[idx(i - 1, j)] ?? 0) + 1,
        (dp[idx(i, j - 1)] ?? 0) + 1,
        (dp[idx(i - 1, j - 1)] ?? 0) + cost,
      );
    }
  }
  return dp[idx(m, n)] ?? 0;
}

function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

// ── Context Engine ─────────────────────────────────────
async function loadPromptConfig(workspaceId: string) {
  const db = getDb();
  const configs = await db
    .select()
    .from(AiPromptConfig)
    .where(
      and(
        eq(AiPromptConfig.workspaceId, workspaceId),
        eq(AiPromptConfig.active, true),
      ),
    )
    .limit(1);
  return configs[0] ?? null;
}

async function buildCatalogContext(workspaceId: string): Promise<{
  context: string;
  products: CatalogProduct[];
}> {
  const db = getDb();
  const products = await db
    .select({
      id: Product.id,
      sku: Product.sku,
      name: Product.name,
      categoryId: Product.categoryId,
      brandId: Product.brandId,
    })
    .from(Product)
    .where(eq(Product.workspaceId, workspaceId))
    .orderBy(desc(Product.createdAt))
    .limit(100);

  const categories = await db
    .select({ id: Category.id, name: Category.name })
    .from(Category)
    .where(eq(Category.workspaceId, workspaceId))
    .limit(200);
  const brands = await db
    .select({ id: Brand.id, name: Brand.name })
    .from(Brand)
    .where(eq(Brand.workspaceId, workspaceId))
    .limit(100);

  const catMap = new Map<string, string>();
  for (const c of categories) catMap.set(c.id, c.name);
  const brandMap = new Map<string, string>();
  for (const b of brands) brandMap.set(b.id, b.name);

  const catalogProducts: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    brandId: p.brandId,
    categoryName: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
    brandName: p.brandId ? (brandMap.get(p.brandId) ?? null) : null,
  }));

  if (catalogProducts.length === 0) {
    return {
      context:
        "CATÁLOGO: vacío (nuevos productos serán creados automáticamente).",
      products: [],
    };
  }

  const productLines = catalogProducts
    .map(
      (p) =>
        `- SKU: ${p.sku} | ${p.name}${p.categoryName ? ` [${p.categoryName}]` : ""}${p.brandName ? ` (${p.brandName})` : ""}`,
    )
    .join("\n");

  const categoryList = categories.map((c) => c.name).join(", ");

  return {
    context: `CATÁLOGO EXISTENTE (${catalogProducts.length} productos):\n${productLines}\n\nCATEGORÍAS ACTIVAS: ${categoryList}`,
    products: catalogProducts,
  };
}

function buildFewShotExamples(examples: unknown): string {
  if (!Array.isArray(examples) || examples.length === 0) return "";

  const lines = (examples as Record<string, string>[])
    .map((ex) => {
      let line = `Original: "${ex.original}" → Correcto: "${ex.correct}"`;
      if (ex.wrong) line += ` (no: "${ex.wrong}")`;
      if (ex.category) line += ` [${ex.category}]`;
      return line;
    })
    .join("\n");

  return `\nEJEMPLOS DE CORRECCIÓN (aprende de estos):\n${lines}`;
}

function assembleSystemPrompt(
  base: string,
  catalogContext: string,
  fewShotText: string,
): string {
  return `${base}\n\n${catalogContext}${fewShotText}`;
}

// ── Post-Processing ────────────────────────────────────
function postProcessMatching(
  items: ParsedItem[],
  catalogProducts: CatalogProduct[],
): MatchedItem[] {
  return items.map((item) => {
    let bestMatch: CatalogProduct | null = null;
    let bestSim = 0;
    let matchType: MatchedItem["match_type"];

    // 1. Try exact SKU match
    if (item.sku_hint) {
      const skuMatch = catalogProducts.find(
        (p) => p.sku.toLowerCase() === item.sku_hint?.toLowerCase(),
      );
      if (skuMatch) {
        return {
          ...item,
          suggested_product_id: skuMatch.id,
          match_type: "exact_sku" as const,
          match_confidence: 100,
          image_url: null,
          image_description: null,
        };
      }
    }

    // 2. Fuzzy name match
    for (const product of catalogProducts) {
      const sim = similarity(item.name_es, product.name);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = product;
      }
    }

    if (bestMatch && bestSim >= 0.8) {
      matchType = "name_similarity";
    } else if (bestMatch && bestSim >= 0.5) {
      matchType = "name_similarity";
    } else {
      matchType = "no_match";
      bestMatch = null;
      bestSim = 0;
    }

    return {
      ...item,
      suggested_product_id: bestMatch?.id ?? null,
      match_type: matchType,
      match_confidence: Math.round(bestSim * 100),
      image_url: null,
      image_description: null,
    };
  });
}

// ── File Parsing ───────────────────────────────────────
async function parseExcel(buffer: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "array",
    sheetRows: MAX_SHEET_ROWS,
  });
  const allRows: string[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    for (const row of rows) {
      const cleaned = row.map((cell) => String(cell).trim());
      if (cleaned.some((c) => c.length > 0)) {
        allRows.push(cleaned);
      }
    }
  }

  return allRows;
}

async function parsePDF(buffer: ArrayBuffer): Promise<string[][]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const lines = result.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) => [line]);
}

// CSV parsing removed — only Excel and PDF are supported

// ── Image Extraction ───────────────────────────────────
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "tiff",
]);

async function extractImagesFromXlsx(
  buffer: ArrayBuffer,
): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.entries(zip.files);
  // Reject before decompressing anything — a zip bomb can carry far more
  // entries than any real .xlsx workbook ever would (F8.3).
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new PayloadTooLargeError(
      `El archivo contiene demasiadas entradas comprimidas (> ${MAX_ZIP_ENTRIES})`,
    );
  }

  const images: ExtractedImage[] = [];
  let idx = 0;
  let uncompressedBytes = 0;

  for (const [path, file] of entries) {
    if (images.length >= MAX_TOTAL_IMAGES) break; // Stop decompressing once we have enough
    if (file.dir) continue;
    // Images in XLSX are stored in xl/media/
    if (!path.startsWith("xl/media/")) continue;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const data = await file.async("nodebuffer");
    uncompressedBytes += data.length;
    if (uncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new PayloadTooLargeError(
        `El contenido descomprimido del archivo excede ${MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)}MB`,
      );
    }

    const compressed = await compressImage(data);
    const mimeType =
      ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";

    images.push({
      buffer: compressed,
      index: idx++,
      fileName: path.split("/").pop() ?? `image_${idx}`,
      mimeType,
    });
  }

  return images;
}

function extractImagesFromPdf(_buffer: ArrayBuffer): Promise<ExtractedImage[]> {
  // PDF image extraction is complex and requires pdf.js or similar.
  // For now we return empty — PDF text is still fully processed by Qwen3.
  // Phase 2 enhancement: integrate pdfjs-dist for full image extraction.
  return Promise.resolve([]);
}

async function compressImage(input: Buffer): Promise<Buffer> {
  // limitInputPixels rejects decompression-bomb images (a tiny file that
  // decodes to an enormous pixel grid) before sharp allocates for them (F8.3).
  const sharpOptions = { limitInputPixels: MAX_INPUT_PIXELS };

  // If already small enough, resize for faster API processing
  if (input.length <= MAX_IMAGE_BYTES) {
    return sharp(input, sharpOptions)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  // Progressively reduce quality until under limit
  let quality = 80;
  let result = input;
  while (result.length > MAX_IMAGE_BYTES && quality > 20) {
    result = await sharp(input, sharpOptions)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    quality -= 10;
  }
  return result;
}

// ── Vision Pipeline (Llama 4 Scout) ────────────────────
const VISION_SYSTEM_PROMPT = `Eres CENDARO-VISION-AI, un analista visual de productos de importación.
Tu misión es analizar imágenes de productos extraídas de packing lists.

Para CADA imagen:
1. IDENTIFICA el producto visible con la mayor precisión posible
2. LEE cualquier texto visible en la imagen (OCR): etiquetas, marcas, códigos
3. DETERMINA la categoría más probable
4. DESCRIBE materiales, colores, y tamaño estimado
5. Si el producto está empaquetado, describe tanto el empaque como el contenido visible

CATEGORÍAS VÁLIDAS (NO LIMITATIVAS):
Electrónica, Herramientas, Ferretería, Automotriz, Peluquería y Belleza,
Productos Adultos, Hogar y Cocina, Juguetes, Ropa y Accesorios,
Deportes, Iluminación, Cables y Conectores, Papelería, Mascotas,
Salud y Cuidado Personal, Decoración, Seguridad, y cualquier otra.

Responde ÚNICAMENTE con JSON válido:
{"images": [
  {
    "index": 0,
    "product_name_es": "nombre en español",
    "visible_text": "texto OCR",
    "category": "categoría",
    "brand_visible": "marca o null",
    "material": "material",
    "colors": ["color1"],
    "size_estimate": "dimensiones aprox.",
    "packaging": "tipo de empaque",
    "confidence": 85
  }
]}`;

async function analyzeImagesWithVision(
  images: ExtractedImage[],
  apiKey: string,
): Promise<VisionResult[]> {
  if (images.length === 0) return [];

  const allResults: VisionResult[] = [];

  // Process in batches of MAX_IMAGES_PER_VISION_REQUEST
  for (let i = 0; i < images.length; i += MAX_IMAGES_PER_VISION_REQUEST) {
    const batch = images.slice(i, i + MAX_IMAGES_PER_VISION_REQUEST);

    // Support both URL references (Tier 3) and base64 (legacy FormData path)
    const imageContent = batch.map((img) => {
      const urlImage = img as ExtractedImage & { _url?: string };
      return {
        type: "image_url" as const,
        image_url: {
          // Tier 3: Use URL directly (Groq fetches up to 20MB server-to-server)
          // Legacy: Use base64 data URI (for FormData/PDF path, ≤4MB)
          url:
            urlImage._url ??
            `data:${img.mimeType};base64,${img.buffer.toString("base64")}`,
        },
      };
    });

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza ${batch.length === 1 ? "1 imagen" : `${batch.length} imágenes`} de productos del packing list. Índices: ${batch.map((b) => b.index).join(", ")}.`,
              },
              ...imageContent,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as GroqVisionResponse;
      const content = data.choices[0]?.message.content ?? "{}";
      try {
        const parsed = JSON.parse(content) as { images?: unknown };
        if (Array.isArray(parsed.images)) {
          for (const entry of parsed.images) {
            const result = VisionResultSchema.safeParse(entry);
            if (result.success) allResults.push(result.data);
          }
        }
      } catch {
        // Vision failed for this batch — continue with text-only
      }
    }
  }

  return allResults;
}

// ── Merge Engine ───────────────────────────────────────
function mergeTextAndVision(
  textItems: MatchedItem[],
  visionResults: VisionResult[],
): MatchedItem[] {
  // Create a map of vision results by index
  const visionMap = new Map<number, VisionResult>();
  for (const vr of visionResults) {
    visionMap.set(vr.index, vr);
  }

  return textItems.map((item, idx) => {
    const vision = visionMap.get(idx);
    if (!vision) return item;

    // Enrich with vision data
    const enriched = { ...item };

    // If vision has higher confidence category, prefer it
    if (vision.category && vision.confidence > item.confidence) {
      enriched.category_hint = vision.category;
    }

    // Add vision description
    const descParts: string[] = [];
    if (vision.product_name_es) descParts.push(vision.product_name_es);
    if (vision.material) descParts.push(`Material: ${vision.material}`);
    if (vision.colors.length > 0)
      descParts.push(`Colores: ${vision.colors.join(", ")}`);
    if (vision.visible_text) descParts.push(`OCR: ${vision.visible_text}`);
    if (vision.brand_visible) descParts.push(`Marca: ${vision.brand_visible}`);

    enriched.image_description =
      descParts.length > 0 ? descParts.join(" | ") : null;

    return enriched;
  });
}

// ── Groq API Call (context-aware) ──────────────────────
async function callGroq(
  rows: string[][],
  chunkIndex: number,
  totalChunks: number,
  model: string,
  apiKey: string,
  systemPrompt: string,
): Promise<ParsedItem[]> {
  const rowsText = rows
    .map((row, i) => `${i + 1}. ${row.join(" | ")}`)
    .join("\n");

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Analiza estos items del packing list (lote ${chunkIndex + 1} de ${totalChunks}).

Items:
${rowsText}

Devuelve SOLO {"items": [...]} sin explicaciones ni markdown.`,
    },
  ];

  // Retry with exponential backoff for rate limits
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2048, // 8 items generate ~300-800 tokens. 2048 keeps total TPM per request ~3K.
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("retry-after") ?? "2",
        10,
      );
      const delay = retryAfter * 1000 * (attempt + 1); // exponential
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GroqResponse;
    let content = data.choices[0]?.message.content ?? "{}";

    // Sanitize Qwen3 think tags and /no_think markers
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    content = content.replace(/\/no_think/g, "").trim();

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value)) return parseItemsArray(value);
      }
      return [];
    } catch {
      const regex = /\[[\s\S]*\]/;
      const match = regex.exec(content);
      if (match) {
        return parseItemsArray(JSON.parse(match[0]) as unknown);
      }
      return [];
    }
  }
  throw new Error("Groq API: max retries exceeded");
}

// ── Chunk Processing with Concurrency ──────────────────
async function processChunks(
  chunks: string[][][],
  apiKey: string,
  systemPrompt: string,
): Promise<{ items: ParsedItem[]; failedChunks: number[] }> {
  const results: (ParsedItem[] | undefined)[] = new Array<
    ParsedItem[] | undefined
  >(chunks.length);
  const failedChunks: number[] = [];

  for (
    let batchStart = 0;
    batchStart < chunks.length;
    batchStart += MAX_CONCURRENT
  ) {
    const batchEnd = Math.min(batchStart + MAX_CONCURRENT, chunks.length);
    const batchPromises: Promise<void>[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const idx = i;
      batchPromises.push(
        callGroq(chunk, idx, chunks.length, PRIMARY_MODEL, apiKey, systemPrompt)
          .catch(async () => {
            try {
              return await callGroq(
                chunk,
                idx,
                chunks.length,
                FALLBACK_MODEL,
                apiKey,
                systemPrompt,
              );
            } catch {
              failedChunks.push(idx);
              return [] as ParsedItem[];
            }
          })
          .then((items) => {
            results[idx] = items;
          }),
      );
    }

    await Promise.all(batchPromises);

    // Respect Groq rate limits between batches
    if (batchStart + MAX_CONCURRENT < chunks.length) {
      await sleep(INTER_CHUNK_DELAY_MS);
    }
  }

  const allItems: ParsedItem[] = [];
  for (const batch of results) {
    if (batch) allItems.push(...batch);
  }

  return { items: allItems, failedChunks };
}

// ── Route Segment Config ───────────────────────────────
export const maxDuration = 60; // seconds — AI processing needs time

// ── Route Handler ──────────────────────────────────────

// Body validation for the client-parsed JSON path (F8.2) — the browser
// already parsed the Excel file; this is the untrusted wire boundary.
const ClientParsedInputSchema = z.object({
  rows: z
    .array(z.array(z.string().max(1000)).max(50))
    .min(1)
    .max(5000),
  containerId: z.string().uuid(),
  /** Supabase Storage URLs for Groq Vision via URL reference (Tier 3) —
   * origin/path/workspace-scope checked in isOwnedStorageUrl before use. */
  imageUrls: z.array(z.string().url()).max(MAX_TOTAL_IMAGES).optional(),
  chunkIndex: z.number().int().min(0).optional(),
  totalChunks: z.number().int().min(1).optional(),
});
type ClientParsedInput = z.infer<typeof ClientParsedInputSchema>;

/**
 * A packing-list image URL must point at this project's own Supabase Storage
 * public bucket, under this caller's own workspace path — never an arbitrary
 * external URL, since we hand it to Groq's server-to-server fetcher (SSRF /
 * confused-deputy risk otherwise — F8.2).
 */
function isOwnedStorageUrl(url: string, workspaceId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const storageOrigin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  return (
    parsed.origin === storageOrigin &&
    parsed.pathname.startsWith("/storage/v1/object/public/") &&
    parsed.pathname.includes(`/${workspaceId}/`)
  );
}

export async function POST(request: NextRequest) {
  if (!env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY no configurada" },
      { status: 500 },
    );
  }

  // ── Authentication Guard ──
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  // getClaims() verifies the JWT locally via cached JWKS — coherent with the
  // rest of the app (proxy.ts, trpc context) instead of a network round-trip
  // to Supabase Auth on every request (F8.1).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = mapClaimsToUser(claimsData?.claims);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // ── Multi-Tenant Workspace Resolution Guard ──
  // x-workspace-id is now mandatory: the old fallback to "any workspace this
  // user belongs to" silently picked an arbitrary one for multi-workspace
  // users, which is the wrong workspace as often as it is the right one (F8.1).
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId || !isValidUuid(workspaceId)) {
    return NextResponse.json(
      {
        error: "Encabezado x-workspace-id requerido y debe ser un UUID válido",
      },
      { status: 400 },
    );
  }

  const db = getDb();
  // is_workspace_member() — same SQL function trpc.ts uses — only returns a
  // row for an active member of an active workspace (migration 018), unlike
  // the raw WorkspaceMember select this replaced.
  const membershipResult = await db.execute<{ member_role: string }>(
    sql`SELECT * FROM is_workspace_member(${user.id}::uuid, ${workspaceId}::uuid)`,
  );
  const membership = membershipResult.rows[0];

  if (!membership) {
    return NextResponse.json(
      { error: "No eres miembro activo de este workspace" },
      { status: 403 },
    );
  }

  const memberRole = membership.member_role as UserRole;
  if (!can(memberRole, "containers", "update")) {
    return NextResponse.json(
      { error: "Permiso denegado: containers.update" },
      { status: 403 },
    );
  }

  const member = { workspaceId, role: memberRole };

  // ── Per-user Rate Limit ──
  // 3 parse requests per 60s per authenticated user.
  // Prevents a compromised session from draining the Groq API quota.
  const { rateLimit } = await import("~/lib/rate-limit");
  const rlResult = await rateLimit(`ai:user:${user.id}`, {
    window: 60_000,
    max: 3,
  });
  if (!rlResult.success) {
    const retryAfter = Math.ceil((rlResult.reset - Date.now()) / 1_000);
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Intente de nuevo más tarde.",
        retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  // ── DoS Guard: Payload Size Limit (F8.2) ──
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Cuerpo de solicitud demasiado grande (máx 10MB)" },
      { status: 413 },
    );
  }

  const apiKey = String(env.GROQ_API_KEY);

  try {
    const contentType = request.headers.get("content-type") ?? "";

    // ── Determine input mode ──
    let rows: string[][];
    let extractedImages: ExtractedImage[] = [];
    let containerId: string;

    if (contentType.includes("application/json")) {
      // ═══ JSON PATH: Client-parsed Excel data (chunked) ═══
      // Browser already parsed the file — we receive lightweight JSON chunks (≤2MB each)
      const rawBody: unknown = await request.json();
      const parsedBody = ClientParsedInputSchema.safeParse(rawBody);

      if (!parsedBody.success) {
        return NextResponse.json(
          { error: "rows (array) y containerId son requeridos" },
          { status: 400 },
        );
      }

      const body: ClientParsedInput = parsedBody.data;
      containerId = body.containerId;
      rows = body.rows;

      // ── Chunked mode: images are NOT embedded in JSON payload ──
      // Images are either:
      //   a) Skipped entirely (text-only mode)
      //   b) Uploaded to Supabase Storage and referenced via imageUrls (Tier 3)
      // Legacy base64 images are ignored in chunked mode to stay under 4.5MB
      if (body.imageUrls && body.imageUrls.length > 0) {
        // Tier 3: Groq Vision via URL reference — images stay in Supabase Storage
        // Each URL can be up to 20MB — Groq fetches directly, zero data through Vercel.
        // Every URL must resolve to this project's own storage, under this
        // caller's own workspace path (F8.2) — reject the whole request
        // rather than silently drop offending URLs, since a URL that fails
        // this check is a sign of a tampered client, not a benign mismatch.
        const hasForeignUrl = body.imageUrls.some(
          (url) => !isOwnedStorageUrl(url, member.workspaceId),
        );
        if (hasForeignUrl) {
          return NextResponse.json(
            {
              error:
                "imageUrls debe apuntar al almacenamiento de este workspace",
            },
            { status: 400 },
          );
        }
        extractedImages = body.imageUrls.map((url, idx) => ({
          buffer: Buffer.alloc(0), // No binary data — URL-only mode
          index: idx,
          fileName: `image_${idx}`,
          mimeType: "image/jpeg",
          _url: url, // Store URL for vision pipeline
        }));
      }
      // Note: body.images (legacy base64) is intentionally ignored in chunked mode
    } else {
      // ═══ FORMDATA PATH: Raw file upload (PDF ≤ 4MB) ═══
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const formContainerId = formData.get("containerId") as string | null;

      if (!file || !formContainerId) {
        return NextResponse.json(
          { error: "Archivo y containerId son requeridos" },
          { status: 400 },
        );
      }

      containerId = formContainerId;

      // Validate file size (Vercel limit is 4.5MB, guard at 4MB)
      if (file.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          {
            error: `Archivo demasiado grande para subida directa (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 4MB. Para archivos más grandes, usa formato Excel — se procesa en el navegador sin límite de tamaño.`,
          },
          { status: 413 },
        );
      }

      const fileName = file.name.toLowerCase();
      const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext),
      );
      const hasValidMime =
        ALLOWED_MIME_TYPES.has(file.type) || file.type === "";

      if (!hasValidExtension || !hasValidMime) {
        return NextResponse.json(
          { error: "Formato no soportado. Use Excel (.xlsx/.xls) o PDF" },
          { status: 400 },
        );
      }

      // Parse file server-side
      const buffer = await file.arrayBuffer();

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const [parsedRows, images] = await Promise.all([
          parseExcel(buffer),
          extractImagesFromXlsx(buffer),
        ]);
        rows = parsedRows;
        extractedImages = images;
      } else {
        const [parsedRows, images] = await Promise.all([
          parsePDF(buffer),
          extractImagesFromPdf(buffer),
        ]);
        rows = parsedRows;
        extractedImages = images;
      }
    }

    // ── Multi-Tenant Container Ownership Verification ──
    const [container] = await db
      .select({ id: Container.id })
      .from(Container)
      .where(
        and(
          eq(Container.id, containerId),
          eq(Container.workspaceId, member.workspaceId),
        ),
      )
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Contenedor no encontrado o no pertenece a su workspace" },
        { status: 404 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "El archivo está vacío o no se pudo parsear" },
        { status: 400 },
      );
    }

    // ── 1. Load AI Config from DB ──
    const config = await loadPromptConfig(member.workspaceId);

    // ── 2. Build catalog context ──
    const { context: catalogContext, products: catalogProducts } =
      await buildCatalogContext(member.workspaceId);

    // ── 3. Build few-shot examples ──
    const fewShotText = config
      ? buildFewShotExamples(config.fewShotExamples)
      : "";

    // ── 4. Assemble system prompt ──
    const systemPrompt = config
      ? assembleSystemPrompt(config.systemPrompt, catalogContext, fewShotText)
      : `Eres CENDARO-AI, un analista profesional de importación para un distribuidor mayorista multi-categoría en Venezuela.

Tu ÚNICA tarea: analizar packing lists y devolver JSON estructurado. NO inventes datos. Si no puedes determinar un valor, usa null.

CATEGORÍAS (NO limitativas): Electrónica, Herramientas, Ferretería, Automotriz, Peluquería y Belleza, Productos Adultos, Hogar y Cocina, Juguetes, Ropa y Accesorios, Deportes, Iluminación, Cables y Conectores, Papelería, Mascotas, Salud y Cuidado Personal, Decoración, Seguridad, y cualquier otra que aplique.

${catalogContext}

REGLAS DE CONFIANZA:
- 90-100: Traducción exacta, categoría clara, datos completos
- 60-89: Traducción probable, categoría inferida
- <60: Traducción incierta o datos ambiguos

Responde ÚNICAMENTE con JSON válido:
{"items": [{"original_name": "texto original", "name_es": "traducción al español", "quantity": 1, "unit_cost": null, "weight_kg": null, "sku_hint": null, "category_hint": "categoría", "confidence": 85}]}`;

    // ── 5. Chunk text rows ──
    const chunks: string[][][] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }

    // ── 6. Run DUAL AI PIPELINES in parallel ──
    // Pipeline A: Qwen3-32B processes text (translation, categorization)
    // Pipeline B: Llama 4 Scout processes images (OCR, visual analysis)
    // Vision is best-effort — if it fails, text still works
    const [textResult, visionResults] = await Promise.all([
      processChunks(chunks, apiKey, systemPrompt),
      analyzeImagesWithVision(extractedImages, apiKey).catch(
        () => [] as VisionResult[],
      ),
    ]);

    const { items, failedChunks } = textResult;

    // ── 7. Post-process: fuzzy match against catalog ──
    const rawMatched = postProcessMatching(items, catalogProducts);

    // ── 8. Merge text + vision results ──
    const matchedItems = mergeTextAndVision(rawMatched, visionResults);

    // ── 9. Stats ──
    const stats = {
      matched: matchedItems.filter(
        (i) =>
          i.match_type === "exact_sku" ||
          (i.match_type === "name_similarity" && i.match_confidence >= 80),
      ).length,
      review: matchedItems.filter(
        (i) => i.match_type === "name_similarity" && i.match_confidence < 80,
      ).length,
      newItems: matchedItems.filter(
        (i) => i.match_type === "no_match" || i.match_type === "ai_only",
      ).length,
      highConfidence: matchedItems.filter((i) => i.confidence >= 90).length,
      mediumConfidence: matchedItems.filter(
        (i) => i.confidence >= 60 && i.confidence < 90,
      ).length,
      lowConfidence: matchedItems.filter((i) => i.confidence < 60).length,
      imagesExtracted: extractedImages.length,
      imagesAnalyzed: visionResults.length,
    };

    return NextResponse.json({
      success: true,
      containerId,
      totalRows: rows.length,
      totalChunks: chunks.length,
      failedChunks,
      itemCount: matchedItems.length,
      items: matchedItems,
      stats,
      promptSource: config ? "database" : "fallback",
    });
  } catch (err: unknown) {
    // Log full error server-side for debugging — never expose internals to client
    console.error(
      "[parse-packing-list] Error:",
      err instanceof Error ? err.message : err,
    );

    if (err instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }

    return NextResponse.json(
      { error: "Error procesando packing list. Intente de nuevo más tarde." },
      { status: 500 },
    );
  }
}
