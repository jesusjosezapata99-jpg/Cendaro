"use client";

/**
 * Cendaro — Parse Inventory File Hook
 *
 * Client-side XLSX parsing + header detection.
 * Uses SheetJS with security-hardened options.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §11, §17, §22
 */
import { useCallback, useState } from "react";
import { read, utils } from "xlsx";

import {
  autoMapHeaders,
  normalizeHeader,
} from "../lib/inventory-header-aliases";
import { MAX_ROW_COUNT, validateFile } from "../lib/inventory-validators";

// ── Types ────────────────────────────────────────

export interface ParseResult {
  /** Parsed header row (original values) */
  headers: string[];
  /** All data rows (excluding header) */
  dataRows: string[][];
  /** Auto-detected header mapping: field → column index */
  headerMap: Record<string, number>;
  /** Unmapped header names */
  unmapped: string[];
  /** Sheet name that was parsed */
  sheetName: string;
  /** Total rows including header */
  totalRows: number;
}

export interface ParseError {
  code: string;
  message: string;
}

export interface UseParseInventoryFileReturn {
  /** Parsed result (null until file is parsed) */
  result: ParseResult | null;
  /** Parse error (null if no error) */
  error: ParseError | null;
  /** Whether parsing is in progress */
  isParsing: boolean;
  /** Parse a File object */
  parseFile: (file: File) => Promise<ParseResult | null>;
  /** Reset state */
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────

export function useParseInventoryFile(): UseParseInventoryFileReturn {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<ParseError | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const parseFile = useCallback(
    async (file: File): Promise<ParseResult | null> => {
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
          cellFormula: false, // Prevent formula injection
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

        // 5. Convert to array-of-arrays (raw strings)
        const rawRows = utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        // 6. Validate row count
        if (rawRows.length === 0) {
          setError({ code: "EMPTY_FILE", message: "Archivo vacío" });
          setIsParsing(false);
          return null;
        }

        const firstRow = rawRows[0];
        if (!firstRow) {
          setError({ code: "EMPTY_FILE", message: "Archivo vacío" });
          setIsParsing(false);
          return null;
        }
        const headers = firstRow.map((h) => String(h));
        const dataRows = rawRows
          .slice(1)
          .map((row) => row.map((cell) => String(cell)));

        // Headers only, no data rows (§21.2)
        if (dataRows.length === 0) {
          setError({
            code: "NO_DATA",
            message: "No se encontraron filas de datos",
          });
          setIsParsing(false);
          return null;
        }

        // Too many rows (FR-3)
        if (dataRows.length > MAX_ROW_COUNT) {
          setError({
            code: "TOO_MANY_ROWS",
            message: `Archivo excede ${MAX_ROW_COUNT.toLocaleString()} filas`,
          });
          setIsParsing(false);
          return null;
        }

        // 7. Auto-detect headers using alias map
        const normalizedHeaders = headers.map(normalizeHeader);
        const { map: headerMap, unmapped } = autoMapHeaders(normalizedHeaders);

        const parseResult: ParseResult = {
          headers,
          dataRows,
          headerMap,
          unmapped,
          sheetName,
          totalRows: rawRows.length,
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
