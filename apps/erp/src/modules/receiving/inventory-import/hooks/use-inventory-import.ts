"use client";

/**
 * Cendaro — Inventory Import State Machine Hook
 *
 * Manages the 7-step wizard state via useReducer.
 * Steps: Mode → File → Columns → Validation → Catálogo → Summary → Result
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20, §23
 */
import { useCallback, useReducer } from "react";

import type {
  ImportMode,
  ImportResult,
  InitializeResult,
  ValidatedRow,
} from "@cendaro/api";

import type { InitializeValidatedRow } from "../lib/inventory-validators";

// ── State ────────────────────────────────────────

export interface ImportState {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  warehouseId: string;
  warehouseName: string;
  mode: ImportMode | null;
  file: File | null;
  rawRows: string[][];
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  validatedRows: ValidatedRow[];
  validationStats: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    skipped: number;
  } | null;
  commitResult: ImportResult | null;
  /** Initialize mode: validated rows ready for catalog preview */
  initializeRows: InitializeValidatedRow[];
  /** Initialize mode: catalog preview data (brands + products to create) */
  catalogPreview: {
    brands: { name: string; isNew: boolean }[];
    products: { sku: string; name: string; brand: string; isNew: boolean }[];
  } | null;
  /** Initialize mode: commit result */
  initializeResult: InitializeResult | null;
  idempotencyKey: string;
  forceLocked: boolean;
  isProcessing: boolean;
  error: string | null;
}

// ── Actions ──────────────────────────────────────

type ImportAction =
  | { type: "SELECT_MODE"; mode: ImportMode }
  | { type: "SET_FILE"; file: File }
  | {
      type: "PARSE_COMPLETE";
      headers: string[];
      dataRows: string[][];
      headerMap: Record<string, number>;
      unmapped: string[];
      sheetName: string;
    }
  | { type: "UPDATE_HEADER_MAP"; headerMap: Record<string, number> }
  | {
      type: "VALIDATION_COMPLETE";
      validatedRows: ValidatedRow[];
      stats: ImportState["validationStats"];
    }
  | {
      type: "INITIALIZE_VALIDATION_COMPLETE";
      initializeRows: InitializeValidatedRow[];
      stats: ImportState["validationStats"];
      catalogPreview: NonNullable<ImportState["catalogPreview"]>;
    }
  | { type: "SET_FORCE_LOCKED"; value: boolean }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "COMMIT_COMPLETE"; result: ImportResult }
  | { type: "INITIALIZE_COMPLETE"; result: InitializeResult }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | {
      type: "UPDATE_INITIALIZE_ROWS";
      initializeRows: InitializeValidatedRow[];
      catalogPreview: NonNullable<ImportState["catalogPreview"]>;
    }
  | { type: "GO_TO_STEP"; step: ImportState["step"] }
  | { type: "RESTORE_STATE"; payload: Partial<ImportState> }
  | { type: "RESET" };

// ── Reducer ──────────────────────────────────────

function createInitialState(
  warehouseId: string,
  warehouseName: string,
): ImportState {
  return {
    step: 1,
    warehouseId,
    warehouseName,
    mode: null,
    file: null,
    rawRows: [],
    headers: [],
    headerMap: {},
    unmapped: [],
    sheetName: "",
    validatedRows: [],
    validationStats: null,
    commitResult: null,
    initializeRows: [],
    catalogPreview: null,
    initializeResult: null,
    idempotencyKey: crypto.randomUUID(),
    forceLocked: false,
    isProcessing: false,
    error: null,
  };
}

function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case "SELECT_MODE":
      return { ...state, mode: action.mode, step: 2, error: null };

    case "SET_FILE":
      return { ...state, file: action.file, isProcessing: true, error: null };

    case "PARSE_COMPLETE":
      return {
        ...state,
        headers: action.headers,
        rawRows: action.dataRows,
        headerMap: action.headerMap,
        unmapped: action.unmapped,
        sheetName: action.sheetName,
        isProcessing: false,
        step: 3,
      };

    case "UPDATE_HEADER_MAP":
      return { ...state, headerMap: action.headerMap };

    case "VALIDATION_COMPLETE":
      return {
        ...state,
        validatedRows: action.validatedRows,
        validationStats: action.stats,
        isProcessing: false,
        step: 4,
      };

    case "SET_FORCE_LOCKED":
      return { ...state, forceLocked: action.value };

    case "SET_PROCESSING":
      return { ...state, isProcessing: action.value };

    case "COMMIT_COMPLETE":
      return {
        ...state,
        commitResult: action.result,
        isProcessing: false,
        step: 7,
      };

    case "INITIALIZE_VALIDATION_COMPLETE":
      return {
        ...state,
        initializeRows: action.initializeRows,
        validationStats: action.stats,
        catalogPreview: action.catalogPreview,
        isProcessing: false,
        step: 4,
      };

    case "INITIALIZE_COMPLETE":
      return {
        ...state,
        initializeResult: action.result,
        isProcessing: false,
        step: 7,
      };

    case "SET_ERROR":
      return { ...state, error: action.error, isProcessing: false };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "UPDATE_INITIALIZE_ROWS":
      return {
        ...state,
        initializeRows: action.initializeRows,
        catalogPreview: action.catalogPreview,
      };

    case "GO_TO_STEP":
      return { ...state, step: action.step, error: null };

    case "RESTORE_STATE":
      return {
        ...state,
        ...action.payload,
        file: null,
        isProcessing: false,
        error: null,
        commitResult: null,
        initializeResult: null,
      };

    case "RESET":
      return createInitialState(state.warehouseId, state.warehouseName);

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────

export function useInventoryImport(warehouseId: string, warehouseName: string) {
  const [state, dispatch] = useReducer(
    importReducer,
    { warehouseId, warehouseName },
    (init) => createInitialState(init.warehouseId, init.warehouseName),
  );

  const selectMode = useCallback((mode: ImportMode) => {
    dispatch({ type: "SELECT_MODE", mode });
  }, []);

  const setFile = useCallback((file: File) => {
    dispatch({ type: "SET_FILE", file });
  }, []);

  const parseComplete = useCallback(
    (data: {
      headers: string[];
      dataRows: string[][];
      headerMap: Record<string, number>;
      unmapped: string[];
      sheetName: string;
    }) => {
      dispatch({ type: "PARSE_COMPLETE", ...data });
    },
    [],
  );

  const updateHeaderMap = useCallback((headerMap: Record<string, number>) => {
    dispatch({ type: "UPDATE_HEADER_MAP", headerMap });
  }, []);

  const validationComplete = useCallback(
    (validatedRows: ValidatedRow[], stats: ImportState["validationStats"]) => {
      dispatch({ type: "VALIDATION_COMPLETE", validatedRows, stats });
    },
    [],
  );

  const setForceLocked = useCallback((value: boolean) => {
    dispatch({ type: "SET_FORCE_LOCKED", value });
  }, []);

  const setProcessing = useCallback((value: boolean) => {
    dispatch({ type: "SET_PROCESSING", value });
  }, []);

  const commitComplete = useCallback((result: ImportResult) => {
    dispatch({ type: "COMMIT_COMPLETE", result });
  }, []);

  const initializeValidationComplete = useCallback(
    (
      initializeRows: InitializeValidatedRow[],
      stats: ImportState["validationStats"],
      catalogPreview: NonNullable<ImportState["catalogPreview"]>,
    ) => {
      dispatch({
        type: "INITIALIZE_VALIDATION_COMPLETE",
        initializeRows,
        stats,
        catalogPreview,
      });
    },
    [],
  );

  const initializeComplete = useCallback((result: InitializeResult) => {
    dispatch({ type: "INITIALIZE_COMPLETE", result });
  }, []);

  const setError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const goToStep = useCallback((step: ImportState["step"]) => {
    dispatch({ type: "GO_TO_STEP", step });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const updateInitializeRows = useCallback(
    (
      initializeRows: InitializeValidatedRow[],
      catalogPreview: NonNullable<ImportState["catalogPreview"]>,
    ) => {
      dispatch({
        type: "UPDATE_INITIALIZE_ROWS",
        initializeRows,
        catalogPreview,
      });
    },
    [],
  );

  const restoreState = useCallback((payload: Partial<ImportState>) => {
    dispatch({ type: "RESTORE_STATE", payload });
  }, []);

  return {
    state,
    selectMode,
    setFile,
    parseComplete,
    updateHeaderMap,
    validationComplete,
    initializeValidationComplete,
    initializeComplete,
    setForceLocked,
    setProcessing,
    commitComplete,
    setError,
    clearError,
    goToStep,
    reset,
    updateInitializeRows,
    restoreState,
  };
}
