"use client";

/**
 * Cendaro — Validate Inventory Hook
 *
 * Takes parsed rows + product map (+ optional semantic SKU resolutions),
 * returns ValidatedRow[] with status/message.
 */
import { useCallback, useState } from "react";

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import type {
  ProductInfo,
  SemanticInventoryResolution,
  ValidationStats,
} from "../lib/inventory-validators";
import { validateRows } from "../lib/inventory-validators";

export interface UseValidateInventoryReturn {
  validatedRows: ValidatedRow[];
  stats: ValidationStats | null;
  isValidating: boolean;
  validate: (
    dataRows: string[][],
    headerMap: Record<string, number>,
    products: ProductInfo[],
    mode: ImportMode,
    semanticResolutions?: Map<number, SemanticInventoryResolution>,
  ) => ValidatedRow[];
  reset: () => void;
}

export function useValidateInventory(): UseValidateInventoryReturn {
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(
    (
      dataRows: string[][],
      headerMap: Record<string, number>,
      products: ProductInfo[],
      mode: ImportMode,
      semanticResolutions?: Map<number, SemanticInventoryResolution>,
    ): ValidatedRow[] => {
      setIsValidating(true);

      const productMap = new Map<string, ProductInfo>(
        products.map((p) => [p.sku.toUpperCase(), p]),
      );

      const result = validateRows(
        dataRows,
        headerMap,
        productMap,
        mode,
        semanticResolutions,
      );

      setValidatedRows(result.validatedRows);
      setStats(result.stats);
      setIsValidating(false);

      return result.validatedRows;
    },
    [],
  );

  const reset = useCallback(() => {
    setValidatedRows([]);
    setStats(null);
    setIsValidating(false);
  }, []);

  return { validatedRows, stats, isValidating, validate, reset };
}
