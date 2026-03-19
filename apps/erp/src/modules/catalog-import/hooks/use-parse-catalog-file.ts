"use client";

/**
 * Cendaro — Parse Catalog File Hook
 *
 * Client-side XLSX parsing + header detection for catalog imports.
 * Uses SheetJS with security-hardened options.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11, §17
 */
import { useCallback, useState } from "react";
import { read, utils } from "xlsx";

import type { ParsedCatalogRow } from "../lib/catalog-validators";
import { autoMapCatalogHeaders } from "../lib/catalog-header-aliases";
import {
  MAX_ROW_COUNT,
  parseRow,
  validateFile,
} from "../lib/catalog-validators";

// ── Types ────────────────────────────────────────

export interface CatalogParseResult {
  /** Parsed header row (original values) */
  headers: string[];
  /** Auto-detected header mapping: field → column index */
  headerMap: Record<string, number>;
  /** Unmapped header names */
  unmapped: string[];
  /** Parsed data rows */
  parsedRows: ParsedCatalogRow[];
  /** Sheet name that was parsed */
  sheetName: string;
  /** Original filename */
  filename: string;
}

export interface CatalogParseError {
  code: string;
  message: string;
}

export interface UseParseCatalogFileReturn {
  result: CatalogParseResult | null;
  error: CatalogParseError | null;
  isParsing: boolean;
  parseFile: (file: File) => Promise<CatalogParseResult | null>;
  reset: () => void;
}

// ── Smart Header Detection ──────────────────────

/**
 * Scan the first 20 rows looking for the first row that contains
 * ≥2 recognized column aliases. Skips legend/instruction rows.
 */
function findHeaderRow(
  rows: string[][],
): { index: number; headers: string[] } | null {
  const maxScan = Math.min(rows.length, 20);
  for (let i = 0; i < maxScan; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const stringRow = row.map((cell) => String(cell));
    const { map } = autoMapCatalogHeaders(stringRow);
    if (Object.keys(map).length >= 2) {
      return { index: i, headers: stringRow };
    }
  }
  return null;
}

// ── Hook ─────────────────────────────────────────

export function useParseCatalogFile(): UseParseCatalogFileReturn {
  const [result, setResult] = useState<CatalogParseResult | null>(null);
  const [error, setError] = useState<CatalogParseError | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const parseFile = useCallback(
    async (file: File): Promise<CatalogParseResult | null> => {
      setIsParsing(true);
      setError(null);
      setResult(null);

      try {
        // 1. File-level validation
        const fileCheck = validateFile(file);
        if (!fileCheck.valid) {
          setError({
            code: fileCheck.code ?? "UNKNOWN",
            message: fileCheck.message ?? "Error desconocido",
          });
          setIsParsing(false);
          return null;
        }

        // 2. Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();

        // 3. Parse with security-hardened options (PRD §17)
        const workbook = read(buffer, {
          type: "array",
          cellFormula: false,
          cellHTML: false,
          cellStyles: false,
        });

        // 4. Extract first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setError({
            code: "EMPTY_FILE",
            message: "Archivo vacío — sin hojas",
          });
          setIsParsing(false);
          return null;
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          setError({ code: "EMPTY_FILE", message: "Hoja vacía" });
          setIsParsing(false);
          return null;
        }

        // 5. Convert to array-of-arrays
        const rawRows = utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        if (rawRows.length === 0) {
          setError({ code: "EMPTY_FILE", message: "Archivo vacío" });
          setIsParsing(false);
          return null;
        }

        // 6. Smart header detection
        const headerResult = findHeaderRow(rawRows);
        if (!headerResult) {
          setError({
            code: "MISSING_HEADER",
            message:
              "No se encontró una fila de encabezados válida. Asegúrese de incluir columnas como Referencia y Nombre.",
          });
          setIsParsing(false);
          return null;
        }

        const { index: headerIndex, headers } = headerResult;
        const dataRows = rawRows
          .slice(headerIndex + 1)
          .map((row) => row.map((cell) => String(cell)));

        // No data rows
        if (dataRows.length === 0) {
          setError({
            code: "NO_DATA",
            message: "No se encontraron filas de datos después del encabezado",
          });
          setIsParsing(false);
          return null;
        }

        // Too many rows (PRD FR-3)
        if (dataRows.length > MAX_ROW_COUNT) {
          setError({
            code: "TOO_MANY_ROWS",
            message: `Archivo excede ${MAX_ROW_COUNT.toLocaleString()} filas. Divida en múltiples archivos.`,
          });
          setIsParsing(false);
          return null;
        }

        // 7. Auto-detect header mapping
        const { map: headerMap, unmapped } = autoMapCatalogHeaders(headers);

        // 8. Verify required headers
        if (!("sku" in headerMap)) {
          setError({
            code: "MISSING_HEADER",
            message:
              'Columna requerida "SKU" (Referencia) no encontrada en el archivo',
          });
          setIsParsing(false);
          return null;
        }

        if (!("name" in headerMap)) {
          setError({
            code: "MISSING_HEADER",
            message: 'Columna requerida "Nombre" no encontrada en el archivo',
          });
          setIsParsing(false);
          return null;
        }

        // 9. Parse all rows
        const parsedRows: ParsedCatalogRow[] = [];
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row) continue;
          const parsed = parseRow(row, headerMap, headerIndex + i + 2);
          if (parsed) parsedRows.push(parsed);
        }

        if (parsedRows.length === 0) {
          setError({
            code: "NO_DATA",
            message: "Todas las filas están vacías",
          });
          setIsParsing(false);
          return null;
        }

        const parseResult: CatalogParseResult = {
          headers,
          headerMap,
          unmapped,
          parsedRows,
          sheetName,
          filename: file.name,
        };

        setResult(parseResult);
        setIsParsing(false);
        return parseResult;
      } catch {
        setError({
          code: "PARSE_ERROR",
          message:
            "Error al analizar el archivo. Verifique que sea un archivo Excel válido.",
        });
        setIsParsing(false);
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsParsing(false);
  }, []);

  return { result, error, isParsing, parseFile, reset };
}
