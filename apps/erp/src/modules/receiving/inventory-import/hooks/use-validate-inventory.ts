"use client";

/**
 * Cendaro — Validate Inventory Hook
 *
 * Takes parsed rows + product map, returns ValidatedRow[] with status/message.
 * Wraps the pure validateRows function in a React hook with state management.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §11
 */
import { useCallback, useState } from "react";

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import type { ProductInfo, ValidationStats } from "../lib/inventory-validators";
import { validateRows } from "../lib/inventory-validators";

export interface UseValidateInventoryReturn {
  /** Validated rows (null until validation runs) */
  validatedRows: ValidatedRow[];
  /** Validation stats */
  stats: ValidationStats | null;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Run validation */
  validate: (
    dataRows: string[][],
    headerMap: Record<string, number>,
    products: ProductInfo[],
    mode: ImportMode,
  ) => ValidatedRow[];
  /** Reset state */
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
    ): ValidatedRow[] => {
      setIsValidating(true);

      // Build product map (UPPERCASE SKU → ProductInfo)
      const productMap = new Map<string, ProductInfo>(
        products.map((p) => [p.sku.toUpperCase(), p]),
      );

      const result = validateRows(dataRows, headerMap, productMap, mode);

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
