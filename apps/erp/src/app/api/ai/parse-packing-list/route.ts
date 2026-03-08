import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { getDb } from "@cendaro/db/client";
import { AiPromptConfig, Product, Brand, Category } from "@cendaro/db/schema";
import { eq, desc, sql } from "@cendaro/db";
import JSZip from "jszip";
import sharp from "sharp";

// ── Types ──────────────────────────────────────────────
interface ParsedItem {
  original_name: string;
  name_es: string;
  quantity: number;
  unit_cost: number | null;
  weight_kg: number | null;
  sku_hint: string | null;
  category_hint: string | null;
  confidence: number;
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChoice {
  message: { content: string };
}

interface GroqResponse {
  choices: GroqChoice[];
}

interface FewShotExample {
  original: string;
  wrong?: string;
  correct: string;
  category?: string;
}

interface MatchedItem extends ParsedItem {
  suggested_product_id: string | null;
  suggested_product_name: string | null;
  match_confidence: number;
  match_type: "exact_sku" | "name_similarity" | "ai_only" | "no_match";
  image_url: string | null;
  image_description: string | null;
}

interface ExtractedImage {
  buffer: Buffer;
  index: number;
  fileName: string;
  mimeType: string;
}

interface VisionResult {
  index: number;
  product_name_es: string;
  visible_text: string | null;
  category: string | null;
  brand_visible: string | null;
  material: string | null;
  colors: string[];
  size_estimate: string | null;
  packaging: string | null;
  confidence: number;
}

interface GroqVisionResponse {
  choices: { message: { content: string } }[];
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  brandName: string | null;
}

// ── Config ─────────────────────────────────────────────
const PRIMARY_MODEL = "qwen/qwen3-32b";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const CHUNK_SIZE = 500;
const MAX_CONCURRENT = 3;
const MAX_IMAGES_PER_VISION_REQUEST = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB for Groq base64 limit
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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
async function loadPromptConfig() {
  const db = getDb();
  const configs = await db
    .select()
    .from(AiPromptConfig)
    .where(eq(AiPromptConfig.active, true))
    .limit(1);
  return configs[0] ?? null;
}

async function buildCatalogContext(): Promise<{
  context: string;
  products: CatalogProduct[];
}> {
  const db = getDb();

  // Fetch categories
  const categories = await db
    .select({ name: Category.name, slug: Category.slug })
    .from(Category)
    .limit(100);

  // Fetch brands
  const brands = await db
    .select({ name: Brand.name })
    .from(Brand)
    .limit(50);

  // Fetch recent products with category/brand names
  const products = await db
    .select({
      id: Product.id,
      sku: Product.sku,
      name: Product.name,
      categoryName: sql<string | null>`(SELECT c.name FROM category c WHERE c.id = ${Product.categoryId})`,
      brandName: sql<string | null>`(SELECT b.name FROM brand b WHERE b.id = ${Product.brandId})`,
    })
    .from(Product)
    .orderBy(desc(Product.createdAt))
    .limit(50);

  const parts: string[] = [];

  if (categories.length > 0) {
    parts.push(
      `CATEGORÍAS EXISTENTES EN EL CATÁLOGO (usa estas cuando haya match):\n${categories.map((c) => c.name).join(", ")}`,
    );
  }

  if (brands.length > 0) {
    parts.push(
      `MARCAS REGISTRADAS:\n${brands.map((b) => b.name).join(", ")}`,
    );
  }

  if (products.length > 0) {
    parts.push(
      `PRODUCTOS RECIENTES (referencia para matching):\n${products.map((p) => `${p.sku} "${p.name}"${p.categoryName ? ` [${p.categoryName}]` : ""}`).join("\n")}`,
    );
  }

  return {
    context:
      parts.length > 0
        ? parts.join("\n\n")
        : "CATÁLOGO VACÍO: No hay productos registrados aún. Sugiere categorías libremente.",
    products: products as CatalogProduct[],
  };
}

function buildFewShotExamples(examples: unknown): string {
  if (!Array.isArray(examples) || examples.length === 0) {
    return "";
  }

  const typedExamples = examples as FewShotExample[];
  const lines = typedExamples.slice(0, 15).map((ex) => {
    let line = `Original: "${ex.original}" → Correcto: "${ex.correct}"`;
    if (ex.wrong) line += ` (NO "${ex.wrong}")`;
    if (ex.category) line += ` [categoría: ${ex.category}]`;
    return line;
  });

  return `EJEMPLOS DE CORRECCIONES PREVIAS (aprende de estos patrones):\n${lines.join("\n")}`;
}

function assembleSystemPrompt(
  template: string,
  catalogContext: string,
  fewShotText: string,
): string {
  let prompt = template;
  prompt = prompt.replace("{CATALOG_CONTEXT}", catalogContext || "");
  prompt = prompt.replace(
    "{FEW_SHOT_EXAMPLES}",
    fewShotText || "",
  );
  return prompt;
}

// ── Post-processing: Fuzzy Match ───────────────────────
function postProcessMatching(
  items: ParsedItem[],
  catalogProducts: CatalogProduct[],
): MatchedItem[] {
  return items.map((item) => {
    // 1. Try exact SKU match
    if (item.sku_hint) {
      const skuMatch = catalogProducts.find(
        (p) => p.sku.toLowerCase() === item.sku_hint?.toLowerCase(),
      );
      if (skuMatch) {
        return {
          ...item,
          suggested_product_id: skuMatch.id,
          suggested_product_name: skuMatch.name,
          match_confidence: 100,
          match_type: "exact_sku" as const,
          confidence: Math.max(item.confidence, 95),
          image_url: null,
          image_description: null,
        };
      }
    }

    // 2. Try name similarity
    let bestMatch: CatalogProduct | null = null;
    let bestScore = 0;

    for (const product of catalogProducts) {
      const score = similarity(item.name_es, product.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    if (bestMatch && bestScore >= 0.6) {
      return {
        ...item,
        suggested_product_id: bestMatch.id,
        suggested_product_name: bestMatch.name,
        match_confidence: Math.round(bestScore * 100),
        match_type: "name_similarity" as const,
        image_url: null,
        image_description: null,
      };
    }

    // 3. No match found
    return {
      ...item,
      suggested_product_id: null,
      suggested_product_name: null,
      match_confidence: 0,
      match_type: catalogProducts.length === 0 ? "ai_only" as const : "no_match" as const,
      image_url: null,
      image_description: null,
    };
  });
}

// ── File Parsers ───────────────────────────────────────
async function parseExcel(buffer: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return rows.filter((row) =>
    row.some((cell) => String(cell).trim() !== ""),
  );
}

async function parsePDF(buffer: ArrayBuffer): Promise<string[][]> {
  const mod = (await import("pdf-parse")) as {
    default?: (buf: Buffer) => Promise<{ text: string }>;
    [key: string]: unknown;
  };
  const parseFn = (mod.default ?? mod) as unknown as (
    buf: Buffer,
  ) => Promise<{ text: string }>;
  const data = await parseFn(Buffer.from(buffer));
  const lines = data.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) => [line]);
}

function parseCSV(text: string): string[][] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

// ── Image Extraction ───────────────────────────────────
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff"]);

async function extractImagesFromXlsx(buffer: ArrayBuffer): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const images: ExtractedImage[] = [];
  let idx = 0;

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    // Images in XLSX are stored in xl/media/
    if (!path.startsWith("xl/media/")) continue;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const data = await file.async("nodebuffer");
    const compressed = await compressImage(data);
    const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";

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
  // If already small enough, return as-is
  if (input.length <= MAX_IMAGE_BYTES) {
    // Still resize to max 1024px for faster API processing
    return sharp(input)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  // Progressively reduce quality until under 4MB
  let quality = 80;
  let result = input;
  while (result.length > MAX_IMAGE_BYTES && quality > 20) {
    result = await sharp(input)
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

    const imageContent = batch.map((img) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.buffer.toString("base64")}`,
      },
    }));

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
                text: `Analiza ${batch.length} imagen(es) de productos del packing list. Índices: ${batch.map((b) => b.index).join(", ")}.`,
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
        const parsed = JSON.parse(content) as { images?: VisionResult[] };
        if (Array.isArray(parsed.images)) {
          allResults.push(...parsed.images);
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
    if (vision.colors.length > 0) descParts.push(`Colores: ${vision.colors.join(", ")}`);
    if (vision.visible_text) descParts.push(`OCR: ${vision.visible_text}`);
    if (vision.brand_visible) descParts.push(`Marca: ${vision.brand_visible}`);

    enriched.image_description = descParts.length > 0 ? descParts.join(" | ") : null;

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
      max_tokens: 32000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GroqResponse;
  const content = data.choices[0]?.message.content ?? "{}";

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) return value as ParsedItem[];
    }
    return [];
  } catch {
    const regex = /\[[\s\S]*\]/;
    const match = regex.exec(content);
    if (match) {
      return JSON.parse(match[0]) as ParsedItem[];
    }
    return [];
  }
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
  }

  const allItems: ParsedItem[] = [];
  for (const batch of results) {
    if (batch) allItems.push(...batch);
  }

  return { items: allItems, failedChunks };
}

// ── Route Handler ──────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY no configurada" },
      { status: 500 },
    );
  }
  const apiKey = String(env.GROQ_API_KEY);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const containerId = formData.get("containerId") as string | null;

    if (!file || !containerId) {
      return NextResponse.json(
        { error: "Archivo y containerId son requeridos" },
        { status: 400 },
      );
    }

    // ── 1. Load AI Config from DB ──
    const config = await loadPromptConfig();

    // ── 2. Build catalog context ──
    const { context: catalogContext, products: catalogProducts } =
      await buildCatalogContext();

    // ── 3. Build few-shot examples ──
    const fewShotText = config
      ? buildFewShotExamples(config.fewShotExamples)
      : "";

    // ── 4. Assemble system prompt ──
    const systemPrompt = config
      ? assembleSystemPrompt(config.systemPrompt, catalogContext, fewShotText)
      : `Eres un analista de importación. Traduce items al español y responde SOLO con {"items": [...]}.
         Cada item: {"original_name","name_es","quantity","unit_cost","weight_kg","sku_hint","category_hint","confidence"}`;

    // ── 5. Parse file + Extract images ──
    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let rows: string[][];
    let extractedImages: ExtractedImage[] = [];

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Parse text and extract images in parallel
      const [parsedRows, images] = await Promise.all([
        parseExcel(buffer),
        extractImagesFromXlsx(buffer),
      ]);
      rows = parsedRows;
      extractedImages = images;
    } else if (fileName.endsWith(".pdf")) {
      const [parsedRows, images] = await Promise.all([
        parsePDF(buffer),
        extractImagesFromPdf(buffer),
      ]);
      rows = parsedRows;
      extractedImages = images;
    } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
      const text = new TextDecoder().decode(buffer);
      rows = parseCSV(text);
      // CSV files don't contain images
    } else {
      return NextResponse.json(
        { error: "Formato no soportado. Use Excel (.xlsx), PDF o CSV" },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "El archivo está vacío o no se pudo parsear" },
        { status: 400 },
      );
    }

    // ── 6. Chunk text rows ──
    const chunks: string[][][] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }

    // ── 7. Run DUAL AI PIPELINES in parallel ──
    // Pipeline A: Qwen3-32B processes text (translation, categorization)
    // Pipeline B: Llama 4 Scout processes images (OCR, visual analysis)
    const [textResult, visionResults] = await Promise.all([
      processChunks(chunks, apiKey, systemPrompt),
      analyzeImagesWithVision(extractedImages, apiKey),
    ]);

    const { items, failedChunks } = textResult;

    // ── 8. Post-process: fuzzy match against catalog ──
    const rawMatched = postProcessMatching(items, catalogProducts);

    // ── 9. Merge text + vision results ──
    const matchedItems = mergeTextAndVision(rawMatched, visionResults);

    // ── 10. Stats ──
    const stats = {
      matched: matchedItems.filter((i) => i.match_type === "exact_sku" || (i.match_type === "name_similarity" && i.match_confidence >= 80)).length,
      review: matchedItems.filter((i) => i.match_type === "name_similarity" && i.match_confidence < 80).length,
      newItems: matchedItems.filter((i) => i.match_type === "no_match" || i.match_type === "ai_only").length,
      highConfidence: matchedItems.filter((i) => i.confidence >= 90).length,
      mediumConfidence: matchedItems.filter((i) => i.confidence >= 60 && i.confidence < 90).length,
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
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error procesando packing list: ${message}` },
      { status: 500 },
    );
  }
}
