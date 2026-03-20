"use client";

/**
 * Cendaro — Catalog Import State Machine Hook
 *
 * Manages the multi-step catalog import wizard state.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §21
 */
import { useCallback, useReducer } from "react";

import type {
  ParsedCatalogRow,
  ValidatedCatalogRow,
} from "../lib/catalog-validators";
import type { CatalogParseResult } from "./use-parse-catalog-file";
import { validateAllRows } from "../lib/catalog-validators";

// ── Types ────────────────────────────────────────

export type CatalogImportStep =
  | "upload"
  | "header-mapping"
  | "validation"
  | "category-mapping"
  | "dry-run"
  | "result";

export interface CategoryMapping {
  rawCategory: string;
  resolvedCategoryId: string | null;
  resolvedCategoryName: string | null;
  /** Server-suggested name for creating a new category */
  suggestedNewName: string | null;
  /** User-confirmed name for creating a new category */
  newCategoryName?: string;
  matchType: "exact" | "fuzzy" | "alias" | "user_selected" | "skipped";
  confidence?: number;
  suggestions: {
    id: string;
    name: string;
    score: number;
    reason?: string;
  }[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: {
    rowNumber: number;
    sku: string;
    code: string;
    message: string;
  }[];
}

export interface CatalogImportState {
  step: CatalogImportStep;
  /** Parsed file result */
  parseResult: CatalogParseResult | null;
  /** Header map (field → column index), editable by user */
  headerMap: Record<string, number>;
  /** Validated rows (client-side) */
  validatedRows: ValidatedCatalogRow[];
  /** Validation counts */
  validCount: number;
  warningCount: number;
  errorCount: number;
  /** Server-side session ID */
  sessionId: string | null;
  /** Idempotency key for double-submit prevention */
  idempotencyKey: string;
  /** Unresolved categories needing user mapping */
  unresolvedCategories: CategoryMapping[];
  /** Import result (after commit) */
  importResult: ImportResult | null;
  /** Whether a server operation is in progress */
  isLoading: boolean;
  /** Error message from server */
  serverError: string | null;
}

// ── Actions ──────────────────────────────────────

type CatalogImportAction =
  | { type: "FILE_PARSED"; payload: CatalogParseResult }
  | { type: "HEADER_MAP_UPDATED"; payload: Record<string, number> }
  | {
      type: "VALIDATION_COMPLETE";
      payload: {
        rows: ValidatedCatalogRow[];
        validCount: number;
        warningCount: number;
        errorCount: number;
      };
    }
  | {
      type: "SESSION_CREATED";
      payload: { sessionId: string };
    }
  | {
      type: "CATEGORIES_RESOLVED";
      payload: {
        unresolvedCategories: CategoryMapping[];
      };
    }
  | {
      type: "CATEGORY_MAPPING_UPDATED";
      payload: {
        rawCategory: string;
        resolvedCategoryId: string | null;
        resolvedCategoryName: string | null;
        newCategoryName?: string;
        matchType: "user_selected" | "skipped";
      };
    }
  | { type: "CATEGORY_MAPPING_COMPLETE" }
  | { type: "DRY_RUN_COMPLETE" }
  | { type: "COMMIT_COMPLETE"; payload: ImportResult }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "GO_TO_STEP"; payload: CatalogImportStep }
  | { type: "RESTORE_STATE"; payload: Partial<CatalogImportState> }
  | { type: "RESET" };

// ── Initial State ────────────────────────────────

function createInitialState(): CatalogImportState {
  return {
    step: "upload",
    parseResult: null,
    headerMap: {},
    validatedRows: [],
    validCount: 0,
    warningCount: 0,
    errorCount: 0,
    sessionId: null,
    idempotencyKey: crypto.randomUUID(),
    unresolvedCategories: [],
    importResult: null,
    isLoading: false,
    serverError: null,
  };
}

// ── Reducer ──────────────────────────────────────

function catalogImportReducer(
  state: CatalogImportState,
  action: CatalogImportAction,
): CatalogImportState {
  switch (action.type) {
    case "FILE_PARSED":
      return {
        ...state,
        step: "header-mapping",
        parseResult: action.payload,
        headerMap: action.payload.headerMap,
        serverError: null,
      };

    case "HEADER_MAP_UPDATED":
      return {
        ...state,
        headerMap: action.payload,
      };

    case "VALIDATION_COMPLETE":
      return {
        ...state,
        step: "validation",
        validatedRows: action.payload.rows,
        validCount: action.payload.validCount,
        warningCount: action.payload.warningCount,
        errorCount: action.payload.errorCount,
      };

    case "SESSION_CREATED":
      return {
        ...state,
        sessionId: action.payload.sessionId,
      };

    case "CATEGORIES_RESOLVED":
      return {
        ...state,
        step:
          action.payload.unresolvedCategories.length > 0
            ? "category-mapping"
            : "dry-run",
        unresolvedCategories: action.payload.unresolvedCategories,
      };

    case "CATEGORY_MAPPING_UPDATED": {
      const updated = state.unresolvedCategories.map((cat) => {
        if (cat.rawCategory === action.payload.rawCategory) {
          return {
            ...cat,
            resolvedCategoryId: action.payload.resolvedCategoryId,
            resolvedCategoryName: action.payload.resolvedCategoryName,
            newCategoryName: action.payload.newCategoryName,
            matchType: action.payload.matchType,
          };
        }
        return cat;
      });
      return { ...state, unresolvedCategories: updated };
    }

    case "CATEGORY_MAPPING_COMPLETE":
      return { ...state, step: "dry-run" };

    case "DRY_RUN_COMPLETE":
      return { ...state, step: "dry-run" };

    case "COMMIT_COMPLETE":
      return {
        ...state,
        step: "result",
        importResult: action.payload,
        isLoading: false,
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, serverError: action.payload, isLoading: false };

    case "GO_TO_STEP":
      return { ...state, step: action.payload };

    case "RESTORE_STATE":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
        serverError: null,
      };

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────

export function useCatalogImport() {
  const [state, dispatch] = useReducer(
    catalogImportReducer,
    undefined,
    createInitialState,
  );

  const onFileParsed = useCallback((result: CatalogParseResult) => {
    dispatch({ type: "FILE_PARSED", payload: result });
  }, []);

  const onHeaderMapUpdated = useCallback((map: Record<string, number>) => {
    dispatch({ type: "HEADER_MAP_UPDATED", payload: map });
  }, []);

  const onValidate = useCallback(
    (parsedRows: ParsedCatalogRow[], _headerMap: Record<string, number>) => {
      // Re-parse rows with the latest header map if it was changed
      const result = validateAllRows(parsedRows);
      dispatch({
        type: "VALIDATION_COMPLETE",
        payload: {
          rows: result.rows,
          validCount: result.validCount,
          warningCount: result.warningCount,
          errorCount: result.errorCount,
        },
      });
    },
    [],
  );

  const onSessionCreated = useCallback((sessionId: string) => {
    dispatch({ type: "SESSION_CREATED", payload: { sessionId } });
  }, []);

  const onCategoriesResolved = useCallback(
    (unresolvedCategories: CategoryMapping[]) => {
      dispatch({
        type: "CATEGORIES_RESOLVED",
        payload: { unresolvedCategories },
      });
    },
    [],
  );

  const onCategoryMappingUpdated = useCallback(
    (mapping: {
      rawCategory: string;
      resolvedCategoryId: string | null;
      resolvedCategoryName: string | null;
      matchType: "user_selected" | "skipped";
    }) => {
      dispatch({ type: "CATEGORY_MAPPING_UPDATED", payload: mapping });
    },
    [],
  );

  const onCategoryMappingComplete = useCallback(() => {
    dispatch({ type: "CATEGORY_MAPPING_COMPLETE" });
  }, []);

  const onDryRunComplete = useCallback(() => {
    dispatch({ type: "DRY_RUN_COMPLETE" });
  }, []);

  const onCommitComplete = useCallback((result: ImportResult) => {
    dispatch({ type: "COMMIT_COMPLETE", payload: result });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const goToStep = useCallback((step: CatalogImportStep) => {
    dispatch({ type: "GO_TO_STEP", payload: step });
  }, []);

  const restoreState = useCallback((partial: Partial<CatalogImportState>) => {
    dispatch({ type: "RESTORE_STATE", payload: partial });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    onFileParsed,
    onHeaderMapUpdated,
    onValidate,
    onSessionCreated,
    onCategoriesResolved,
    onCategoryMappingUpdated,
    onCategoryMappingComplete,
    onDryRunComplete,
    onCommitComplete,
    setLoading,
    setError,
    goToStep,
    restoreState,
    reset,
  };
}
