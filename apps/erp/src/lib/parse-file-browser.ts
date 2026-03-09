/**
 * parse-file-browser.ts
 *
 * Client-side file processing pipeline for packing list uploads.
 * Parses XLSX/XLS files entirely in the browser to avoid Vercel's
 * 4.5 MB serverless function payload limit.
 *
 * 3-Tier Hybrid Pipeline:
 *   Tier 1 — SheetJS extracts text rows only (ignores images natively)
 *   Tier 2 — Rows are split into ≤2MB JSON chunks for sequential API calls
 *   Tier 3 — JSZip extracts images as Blobs for Supabase Storage upload
 *            (Groq Vision analyzes via URL reference — up to 20MB/image)
 */

import JSZip from "jszip";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────
export interface BrowserImage {
  base64: string;
  mimeType: string;
  index: number;
  fileName: string;
}

/** Lightweight image blob metadata for Supabase Storage upload */
export interface ImageBlob {
  blob: Blob;
  index: number;
  fileName: string;
  mimeType: string;
}

export interface ParsedFileResult {
  rows: string[][];
  images: BrowserImage[];
}

/** Result of text-only parsing + chunking */
export interface ChunkedParseResult {
  rows: string[][];
  chunks: string[][][];
  totalRows: number;
  totalChunks: number;
}

// ── Constants ──────────────────────────────────────────
const MAX_IMAGE_DIMENSION = 1024;
const MAX_IMAGE_BYTES = 200 * 1024; // 200 KB per image after compression
const MAX_TOTAL_IMAGES = 20;
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "tiff",
]);

/**
 * Maximum JSON payload size per chunk in bytes.
 * Vercel's hard limit is 4.5MB — we target 2MB for safety margin
 * (the JSON payload also includes containerId, chunkIndex, etc.)
 */
const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2MB

// ── Text-Only Excel Parsing (Tier 1) ───────────────────

/**
 * Parse an Excel file extracting ONLY text data — no images, no formatting.
 * SheetJS naturally ignores embedded images when using sheet_to_json.
 * This is the fastest possible extraction for large packing lists (130MB+).
 *
 * Performance optimizations:
 *   - cellDates: false → skip date parsing overhead
 *   - cellFormula: false → skip formula evaluation
 *   - cellStyles: false → skip style parsing
 *   - bookImages: false → skip image extraction at workbook level
 */
export async function parseExcelTextOnly(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    cellFormula: false,
    cellStyles: false,
    // @ts-expect-error — bookImages is a valid SheetJS option but not in all type defs
    bookImages: false,
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

// ── Row Chunking (Tier 2) ──────────────────────────────

/**
 * Split rows into chunks that each serialize to ≤ maxBytes of JSON.
 * This ensures each API call stays within Vercel's 4.5MB payload limit.
 *
 * Algorithm: greedily accumulates rows until adding the next row would
 * exceed the byte budget, then starts a new chunk.
 */
export function chunkRows(
  rows: string[][],
  maxBytes: number = MAX_CHUNK_BYTES,
): string[][][] {
  if (rows.length === 0) return [];

  const chunks: string[][][] = [];
  let currentChunk: string[][] = [];
  let currentSize = 2; // account for opening/closing brackets "[]"

  for (const row of rows) {
    // Estimate JSON size: stringify the row + comma + newline
    const rowSize = JSON.stringify(row).length + 2;

    if (currentChunk.length > 0 && currentSize + rowSize > maxBytes) {
      // Push current chunk and start a new one
      chunks.push(currentChunk);
      currentChunk = [row];
      currentSize = 2 + rowSize;
    } else {
      currentChunk.push(row);
      currentSize += rowSize;
    }
  }

  // Push the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Complete text-only parsing + chunking pipeline.
 * Returns rows, pre-chunked arrays, and metadata.
 */
export async function parseAndChunkExcel(
  file: File,
): Promise<ChunkedParseResult> {
  const rows = await parseExcelTextOnly(file);
  const chunks = chunkRows(rows);
  return {
    rows,
    chunks,
    totalRows: rows.length,
    totalChunks: chunks.length,
  };
}

// ── Image Extraction as Blobs (Tier 3) ─────────────────

/**
 * Extract embedded images from an XLSX file as raw Blobs.
 * These Blobs are intended for direct upload to Supabase Storage,
 * where Groq Vision can access them via public URL (up to 20MB/image).
 *
 * No compression is applied — Groq handles images up to 20MB via URL.
 * This is dramatically simpler than the old base64 pipeline.
 */
export async function extractImageBlobs(file: File): Promise<ImageBlob[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const images: ImageBlob[] = [];
  let idx = 0;

  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (idx >= MAX_TOTAL_IMAGES) break;
    if (zipFile.dir) continue;
    if (!path.startsWith("xl/media/")) continue;

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    try {
      const blob = await zipFile.async("blob");
      const mimeType =
        ext === "png"
          ? "image/png"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";

      images.push({
        blob,
        index: idx,
        fileName: path.split("/").pop() ?? `image_${idx}`,
        mimeType,
      });
      idx++;
    } catch {
      // Skip images that fail to extract — non-critical
      continue;
    }
  }

  return images;
}

// ── Legacy Pipeline (backward compatibility) ───────────

/**
 * Parse an Excel file (.xlsx/.xls) in the browser using SheetJS.
 * Returns rows as string[][] — same format the API route expects.
 * @deprecated Use parseExcelTextOnly() for Tier 1 pipeline
 */
export async function parseExcelInBrowser(file: File): Promise<string[][]> {
  return parseExcelTextOnly(file);
}

/**
 * Extract and compress embedded images from an XLSX file (legacy base64).
 * @deprecated Use extractImageBlobs() + Supabase Storage for Tier 3 pipeline
 */
export async function extractImagesFromXlsx(
  file: File,
): Promise<BrowserImage[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const images: BrowserImage[] = [];
  let idx = 0;

  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (idx >= MAX_TOTAL_IMAGES) break;
    if (zipFile.dir) continue;
    if (!path.startsWith("xl/media/")) continue;

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    try {
      const blob = await zipFile.async("blob");
      const compressed = await compressImageInBrowser(blob);
      if (compressed) {
        images.push({
          base64: compressed,
          mimeType: "image/jpeg",
          index: idx,
          fileName: path.split("/").pop() ?? `image_${idx}`,
        });
        idx++;
      }
    } catch {
      continue;
    }
  }

  return images;
}

/**
 * Compress an image blob using the browser Canvas API.
 * @deprecated Part of legacy base64 pipeline
 */
async function compressImageInBrowser(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let result: string | null = null;

      while (quality >= 0.2) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Part = dataUrl.split(",")[1];
        if (!base64Part) break;

        const byteSize = Math.ceil((base64Part.length * 3) / 4);
        if (byteSize <= MAX_IMAGE_BYTES) {
          result = base64Part;
          break;
        }
        quality -= 0.1;
      }

      if (!result) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.2);
        result = dataUrl.split(",")[1] ?? null;
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Complete client-side parsing pipeline for Excel files (legacy).
 * @deprecated Use parseAndChunkExcel() for the chunked pipeline
 */
export async function parseExcelFile(file: File): Promise<ParsedFileResult> {
  const [rows, images] = await Promise.all([
    parseExcelInBrowser(file),
    extractImagesFromXlsx(file),
  ]);
  return { rows, images };
}
