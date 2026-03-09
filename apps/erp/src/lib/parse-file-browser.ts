/**
 * parse-file-browser.ts
 *
 * Client-side file processing pipeline for packing list uploads.
 * Parses XLSX/XLS files entirely in the browser to avoid Vercel's
 * 4.5 MB serverless function payload limit.
 *
 * Pipeline:
 *   1. SheetJS extracts text rows from Excel worksheets
 *   2. JSZip extracts embedded images from the XLSX archive
 *   3. Canvas API compresses images to ≤ 1024px / ≤ 200 KB JPEG
 *
 * This eliminates the need to upload raw binary files to the server.
 * Only lightweight JSON (rows + compressed base64 images) is sent.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";

// ── Types ──────────────────────────────────────────────
export interface BrowserImage {
  base64: string;
  mimeType: string;
  index: number;
  fileName: string;
}

export interface ParsedFileResult {
  rows: string[][];
  images: BrowserImage[];
}

// ── Constants ──────────────────────────────────────────
const MAX_IMAGE_DIMENSION = 1024;
const MAX_IMAGE_BYTES = 200 * 1024; // 200 KB per image after compression
const MAX_TOTAL_IMAGES = 20;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff"]);

// ── Excel Parsing (SheetJS) ────────────────────────────

/**
 * Parse an Excel file (.xlsx/.xls) in the browser using SheetJS.
 * Returns rows as string[][] — same format the API route expects.
 */
export async function parseExcelInBrowser(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
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

// ── Image Extraction (JSZip + Canvas) ──────────────────

/**
 * Extract and compress embedded images from an XLSX file.
 * XLSX files are ZIP archives — images live in `xl/media/`.
 *
 * Uses the browser Canvas API to resize and compress images,
 * replacing the server-side Sharp dependency entirely.
 */
export async function extractImagesFromXlsx(file: File): Promise<BrowserImage[]> {
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
      // Skip images that fail to decode — non-critical
      continue;
    }
  }

  return images;
}

/**
 * Compress an image blob using the browser Canvas API.
 * Resizes to fit within MAX_IMAGE_DIMENSION and compresses to JPEG.
 * Returns a base64 string (without the data:... prefix) or null if failed.
 */
async function compressImageInBrowser(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate scaled dimensions
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

      // Progressive quality reduction until under size limit
      let quality = 0.85;
      let result: string | null = null;

      while (quality >= 0.2) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // dataUrl format: "data:image/jpeg;base64,XXXX..."
        const base64Part = dataUrl.split(",")[1];
        if (!base64Part) break;

        // Estimate byte size from base64 length
        const byteSize = Math.ceil((base64Part.length * 3) / 4);
        if (byteSize <= MAX_IMAGE_BYTES) {
          result = base64Part;
          break;
        }
        quality -= 0.1;
      }

      // If still too large at minimum quality, take it anyway
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

// ── Full Pipeline ──────────────────────────────────────

/**
 * Complete client-side parsing pipeline for Excel files.
 * Extracts text rows AND embedded images in parallel.
 */
export async function parseExcelFile(file: File): Promise<ParsedFileResult> {
  const [rows, images] = await Promise.all([
    parseExcelInBrowser(file),
    extractImagesFromXlsx(file),
  ]);
  return { rows, images };
}
