"use client";

/**
 * Cendaro — Inventory Import Wizard (Zero-Template Multi-File + Semantic SKU Resolution)
 *
 * Main orchestrator connecting all 7 steps via state machine.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ImportMode } from "@cendaro/api";
import { Icons } from "@cendaro/ui/icons";

import type { WarehouseProduct } from "./lib/inventory-template-builder";
import type { SemanticInventoryResolution } from "./lib/inventory-validators";
import { useCurrentUser } from "~/hooks/use-current-user";
import { useTRPC } from "~/trpc/client";
import { useInventoryImport } from "./hooks/use-inventory-import";
import { useParseInventoryFile } from "./hooks/use-parse-inventory-file";
import { useValidateInventory } from "./hooks/use-validate-inventory";
import { normalizeSku } from "./lib/inventory-normalizers";
import { downloadInventoryTemplate } from "./lib/inventory-template-builder";
import { validateInitializeRows } from "./lib/inventory-validators";
import { CatalogPreview } from "./steps/catalog-preview";
import { DryRunSummary } from "./steps/dry-run-summary";
import { FileUpload } from "./steps/file-upload";
import { HeaderMapping } from "./steps/header-mapping";
import { ModeSelect } from "./steps/mode-select";
import { ResultSummary } from "./steps/result-summary";
import { ValidationPreview } from "./steps/validation-preview";

const ALL_STEPS = [
  { num: 1, label: "Modo" },
  { num: 2, label: "Archivo" },
  { num: 3, label: "Columnas" },
  { num: 4, label: "Validación" },
  { num: 5, label: "Catálogo" },
  { num: 6, label: "Resumen" },
  { num: 7, label: "Resultado" },
] as const;

function StepIndicator({
  current,
  mode,
  onStepClick,
}: {
  current: number;
  mode: ImportMode | null;
  onStepClick: (step: number) => void;
}) {
  const steps =
    mode === "initialize" ? ALL_STEPS : ALL_STEPS.filter((s) => s.num !== 5);

  return (
    <div className="flex items-center justify-center gap-1" role="tablist">
      {steps.map((s, i) => {
        const isDone = current > s.num;
        const isActive = current === s.num;

        const sharedClasses =
          "flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs font-medium transition-all";

        const colorClasses = isActive
          ? "bg-primary text-primary-foreground"
          : isDone
            ? "bg-status-success-bg text-status-success-fg"
            : "bg-muted text-muted-foreground";

        return (
          <div key={s.num} className="flex items-center gap-1">
            {isDone ? (
              <button
                type="button"
                onClick={() => onStepClick(s.num)}
                className={`${sharedClasses} ${colorClasses} cursor-pointer hover:scale-105 active:scale-95`}
                title={`Volver a ${s.label}`}
              >
                <Icons.Check className="size-3" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ) : (
              <div
                role="tab"
                aria-selected={isActive}
                className={`${sharedClasses} ${colorClasses} ${!isActive ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {i + 1}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            )}
            {i < steps.length - 1 && (
              <div
                className={`h-px w-4 transition-colors sm:w-8 ${
                  current > s.num ? "bg-status-success-fg" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface InventoryImportWizardProps {
  warehouseId: string;
}

export function InventoryImportWizard({
  warehouseId,
}: InventoryImportWizardProps) {
  const trpc = useTRPC();
  const { profile } = useCurrentUser();
  const canOverrideStock =
    profile?.role === "owner" || profile?.role === "admin";

  const { data: warehouse } = useQuery(
    trpc.inventory.getWarehouseDetail.queryOptions({ id: warehouseId }),
  );

  const warehouseName = warehouse?.name ?? "Almacén";

  const {
    state,
    selectMode,
    parseComplete,
    updateHeaderMap,
    validationComplete,
    initializeValidationComplete,
    initializeComplete,
    updateInitializeRows,
    setForceLocked,
    setProcessing,
    commitComplete,
    setError,
    goToStep,
    reset,
    restoreState,
  } = useInventoryImport(warehouseId, warehouseName);

  const STORAGE_KEY = `cendaro-import-wizard-${warehouseId}`;
  const hasRestored = useRef(false);
  const [wasRestored, setWasRestored] = useState(false);
  const [isResolvingSemantic, setIsResolvingSemantic] = useState(false);

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<typeof state>;
      if (parsed.step && parsed.step > 1) {
        restoreState(parsed);
        setWasRestored(true);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [STORAGE_KEY, restoreState]);

  useEffect(() => {
    if (state.step <= 1) return;
    try {
      const {
        file: _f,
        isProcessing: _p,
        error: _e,
        commitResult: _cr,
        initializeResult: _ir,
        ...persistable
      } = state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [state, STORAGE_KEY]);

  const {
    error: parseError,
    isParsing,
    parseFiles,
    reset: resetParser,
  } = useParseInventoryFile();

  const { validate } = useValidateInventory();

  const { data: products } = useQuery(
    trpc.inventoryImport.getWarehouseProducts.queryOptions({ warehouseId }),
  );

  // Zero-Template AI & Semantic SKU mutations
  const matchCatalogMutation = useMutation(
    trpc.aiImport.matchCatalogItems.mutationOptions(),
  );
  const saveProfileMutation = useMutation(
    trpc.aiImport.saveTemplateProfile.mutationOptions(),
  );

  const persistLearnedProfiles = () => {
    for (const profile of state.learnedProfilesToSave) {
      saveProfileMutation.mutate(profile);
    }
  };

  // Commit mutation (Replace/Adjust)
  const commitMutation = useMutation(
    trpc.inventoryImport.commit.mutationOptions({
      onSuccess: (result) => {
        commitComplete(result);
        persistLearnedProfiles();
        if (result.failed === 0) {
          toast.success(
            `Importación completada: ${result.committed} productos actualizados`,
          );
        } else {
          toast.warning(
            `Importación parcial: ${result.committed} éxitos, ${result.failed} fallos`,
          );
        }
      },
      onError: (err) => {
        setError(err.message);
        setProcessing(false);
        toast.error("Error al importar: " + err.message);
      },
    }),
  );

  // Initialize commit mutation
  const initializeCommitMutation = useMutation(
    trpc.inventoryImport.initializeCommit.mutationOptions({
      onSuccess: (result) => {
        initializeComplete(result);
        persistLearnedProfiles();
        toast.success(
          `Inicialización completada: ${result.brandsCreated} marcas, ${result.productsCreated} productos, ${result.stockEntries} stock`,
        );
      },
      onError: (err) => {
        setError(err.message);
        setProcessing(false);
        toast.error("Error al inicializar: " + err.message);
      },
    }),
  );

  // ── Handlers ─────────────────────────

  const handleFilesSelect = async (files: File[]) => {
    const result = await parseFiles(files);
    if (result) {
      parseComplete({
        headers: result.headers,
        dataRows: result.dataRows,
        headerMap: result.headerMap,
        unmapped: result.unmapped,
        sheetName: result.sheetName,
        filenameLabel: result.filenameLabel,
        aiSummary: result.aiSummary,
        learnedProfilesToSave: result.learnedProfilesToSave,
        isMultiSchemaBatch: result.isMultiSchemaBatch,
      });
    }
  };

  const handleConfirmMapping = async () => {
    if (!state.mode) return;

    if (state.mode === "initialize") {
      const existingSkus = products
        ? new Set(products.map((p) => p.sku.toUpperCase()))
        : undefined;
      const result = validateInitializeRows(
        state.rawRows,
        state.headerMap,
        existingSkus,
      );

      const brandSet = new Map<string, boolean>();
      const productList: {
        sku: string;
        name: string;
        brand: string;
        isNew: boolean;
      }[] = [];

      for (const row of result.validatedRows) {
        if (row.status === "error") continue;
        if (!brandSet.has(row.brand)) {
          brandSet.set(row.brand, true);
        }
        productList.push({
          sku: row.sku,
          name: row.productName,
          brand: row.brand,
          isNew: !(existingSkus?.has(row.sku) ?? false),
        });
      }

      const catalogPreview = {
        brands: Array.from(brandSet.entries()).map(([name]) => ({
          name,
          isNew: true,
        })),
        products: productList,
      };

      initializeValidationComplete(
        result.validatedRows,
        result.stats,
        catalogPreview,
      );
      return;
    }

    // Replace / Adjust mode: resolve missing/unmatched SKUs via Semantic RAG (`matchCatalogItems`)
    if (!products) return;

    const knownSkuSet = new Set(products.map((p) => p.sku.toUpperCase()));
    const semanticResolutions = new Map<number, SemanticInventoryResolution>();

    const unresolvedTargets: {
      rowIdx: number;
      sku?: string;
      name: string;
      barcode?: string;
      brandRaw?: string;
    }[] = [];

    for (let i = 0; i < state.rawRows.length; i++) {
      const row = state.rawRows[i];
      if (!row) continue;

      const rawSku =
        state.headerMap.sku !== undefined
          ? normalizeSku(String(row[state.headerMap.sku] ?? ""))
          : "";
      if (rawSku && knownSkuSet.has(rawSku)) {
        continue;
      }

      const prodName =
        state.headerMap.producto !== undefined
          ? String(row[state.headerMap.producto] ?? "").trim()
          : "";
      const barcode =
        state.headerMap.barcode !== undefined
          ? String(row[state.headerMap.barcode] ?? "").trim()
          : "";
      const brandRaw =
        state.headerMap.marca !== undefined
          ? String(row[state.headerMap.marca] ?? "").trim()
          : "";

      const lookupName = prodName || rawSku || barcode;
      if (lookupName) {
        unresolvedTargets.push({
          rowIdx: i,
          sku: rawSku || undefined,
          name: lookupName.slice(0, 512),
          barcode: barcode ? barcode.slice(0, 128) : undefined,
          brandRaw: brandRaw ? brandRaw.slice(0, 256) : undefined,
        });
      }
    }

    if (unresolvedTargets.length > 0) {
      setIsResolvingSemantic(true);
      try {
        const BATCH_SIZE = 1500;
        for (
          let start = 0;
          start < unresolvedTargets.length;
          start += BATCH_SIZE
        ) {
          const slice = unresolvedTargets.slice(start, start + BATCH_SIZE);
          const matches = await matchCatalogMutation.mutateAsync({
            targetDomain: "inventory",
            items: slice.map((u) => ({
              sku: u.sku,
              skuAutoGenerated: !u.sku,
              name: u.name,
              barcode: u.barcode,
              brandRaw: u.brandRaw,
            })),
          });
          for (const m of matches) {
            const target = slice[m.rowIndex];
            if (!target) continue;
            semanticResolutions.set(target.rowIdx, {
              classification: m.classification,
              matchedSku: m.matchedProductSku,
              matchedName: m.matchedProductName,
              confidence: m.confidence,
            });
          }
        }
      } catch {
        // Degrade gracefully to deterministic exact-SKU lookup
      } finally {
        setIsResolvingSemantic(false);
      }
    }

    const validated = validate(
      state.rawRows,
      state.headerMap,
      products,
      state.mode,
      semanticResolutions,
    );

    const stats = {
      total: validated.length,
      valid: validated.filter((r) => r.status === "valid").length,
      warnings: validated.filter((r) => r.status === "warning").length,
      errors: validated.filter((r) => r.status === "error").length,
      skipped: state.rawRows.length - validated.length,
    };

    validationComplete(validated, stats);
  };

  const handleConfirmImport = () => {
    if (!state.mode) return;

    const rowsToCommit = state.validatedRows.filter(
      (r) =>
        r.status === "valid" ||
        (r.status === "warning" && state.forceLocked && r.isLocked),
    );

    if (rowsToCommit.length === 0) {
      setError("No hay filas válidas para importar");
      return;
    }

    setProcessing(true);
    commitMutation.mutate({
      warehouseId,
      mode: state.mode,
      rows: rowsToCommit.map((r) => ({
        rowNumber: r.rowNumber,
        sku: r.sku,
        quantity: r.quantity,
        productId: r.productId,
        currentQuantity: r.currentQuantity,
      })),
      filename: state.filenameLabel || (state.file?.name ?? "import.xlsx"),
      idempotencyKey: state.idempotencyKey,
      forceLocked: state.forceLocked,
    });
  };

  const handleConfirmInitialize = () => {
    const validRows = state.initializeRows.filter(
      (r) => r.status === "valid" || r.status === "warning",
    );
    if (validRows.length === 0) {
      setError("No hay filas válidas para inicializar");
      return;
    }

    setProcessing(true);
    initializeCommitMutation.mutate({
      warehouseId,
      rows: validRows.map((r) => ({
        rowNumber: r.rowNumber,
        brand: r.brand,
        sku: r.sku,
        productName: r.productName,
        bultos: r.bultos,
        cajasPerBulk: r.cajasPerBulk,
        unidPerCaja: r.unidPerCaja,
        presentacion: r.presentacion,
        totalUnits: r.totalUnits,
      })),
      filename: state.filenameLabel || (state.file?.name ?? "import.xlsx"),
      idempotencyKey: state.idempotencyKey,
    });
  };

  const handleDownloadTemplate = () => {
    if (state.mode === "initialize") {
      downloadInventoryTemplate("initialize");
      return;
    }
    if (!products) {
      toast.error("Cargando catálogo de productos...");
      return;
    }
    const warehouseProducts: WarehouseProduct[] = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brandName: p.brandName,
      unitsPerBox: p.unitsPerBox,
      boxesPerBulk: p.boxesPerBulk,
      presentationQty: p.presentationQty,
      quantity: p.quantity,
      isLocked: p.isLocked,
    }));
    downloadInventoryTemplate(state.mode ?? "replace", warehouseProducts);
  };

  const handleReset = () => {
    reset();
    resetParser();
    sessionStorage.removeItem(STORAGE_KEY);
    setWasRestored(false);
  };

  return (
    <div className="space-y-6 py-4 lg:py-8" role="tabpanel">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/inventory"
          className="hover:text-foreground transition-colors"
        >
          Inventario
        </Link>
        <Icons.ChevronRight className="size-4" />
        <Link
          href={`/inventory/warehouse/${warehouseId}`}
          className="hover:text-foreground transition-colors"
        >
          {warehouseName}
        </Link>
        <Icons.ChevronRight className="size-4" />
        <span className="text-foreground font-medium">Importar</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-medium tracking-tight">
          Importar Inventario
        </h1>
        {state.step < 7 && (
          <button
            type="button"
            onClick={handleReset}
            disabled={state.isProcessing || isParsing || isResolvingSemantic}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-50"
          >
            <Icons.RestartAlt className="size-4.5" />
            Reiniciar
          </button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator
        current={state.step}
        mode={state.mode}
        onStepClick={(step) => {
          if (step < state.step) {
            goToStep(step as 1 | 2 | 3 | 4 | 5 | 6 | 7);
          }
        }}
      />

      {/* Global error */}
      {state.error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-sm">
          <Icons.Error className="size-4.5 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Restored session banner */}
      {wasRestored && state.step > 1 && state.step < 7 && (
        <div className="border-status-warning-fg/30 bg-status-warning-bg text-status-warning-fg flex items-center justify-between gap-2 border px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Icons.Restore className="size-4.5" />
            Sesión restaurada — los datos de tu archivo ya están cargados.
          </div>
          <button
            type="button"
            onClick={() => setWasRestored(false)}
            className="text-status-warning-fg hover:text-foreground transition-colors"
          >
            <Icons.Close className="size-4.5" />
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-75">
        {state.step === 1 && (
          <ModeSelect
            selectedMode={state.mode}
            onSelect={selectMode}
            canInitialize={canOverrideStock}
          />
        )}

        {state.step === 2 && state.mode && (
          <FileUpload
            mode={state.mode}
            onFilesSelect={handleFilesSelect}
            isParsing={isParsing}
            error={parseError?.message ?? null}
            onDownloadTemplate={handleDownloadTemplate}
          />
        )}

        {state.step === 3 && state.mode && (
          <HeaderMapping
            headers={state.headers}
            headerMap={state.headerMap}
            unmapped={state.unmapped}
            sheetName={state.sheetName}
            totalRows={state.rawRows.length + 1}
            mode={state.mode}
            aiSummary={state.aiSummary}
            isMultiSchemaBatch={state.isMultiSchemaBatch}
            isResolvingSemantic={isResolvingSemantic}
            onUpdateMap={updateHeaderMap}
            onConfirm={handleConfirmMapping}
          />
        )}

        {state.step === 4 && state.mode && state.validationStats && (
          <ValidationPreview
            validatedRows={state.validatedRows}
            initializeRows={
              state.mode === "initialize" ? state.initializeRows : undefined
            }
            stats={state.validationStats}
            mode={state.mode}
            onProceed={() => {
              if (state.mode === "initialize") {
                goToStep(5);
              } else {
                goToStep(6);
              }
            }}
            onBack={() => goToStep(3)}
          />
        )}

        {state.step === 5 &&
          state.mode === "initialize" &&
          state.catalogPreview && (
            <CatalogPreview
              initializeRows={state.initializeRows}
              catalogPreview={state.catalogPreview}
              onUpdateRows={updateInitializeRows}
              onProceed={() => goToStep(6)}
              onBack={() => goToStep(4)}
            />
          )}

        {state.step === 6 &&
          state.mode &&
          (state.mode === "initialize" ? (
            <DryRunSummary
              validatedRows={state.validatedRows}
              initializeRows={state.initializeRows}
              mode={state.mode}
              warehouseName={warehouseName}
              forceLocked={false}
              onSetForceLocked={() => {
                /* noop — initialize mode has no lock toggle */
              }}
              onConfirm={handleConfirmInitialize}
              onBack={() => goToStep(5)}
              isProcessing={state.isProcessing}
              canForceLock={false}
            />
          ) : (
            <DryRunSummary
              validatedRows={state.validatedRows}
              mode={state.mode}
              warehouseName={warehouseName}
              forceLocked={state.forceLocked}
              onSetForceLocked={setForceLocked}
              onConfirm={handleConfirmImport}
              onBack={() => goToStep(4)}
              isProcessing={state.isProcessing}
              canForceLock={canOverrideStock}
            />
          ))}

        {state.step === 7 &&
          (state.mode === "initialize" && state.initializeResult ? (
            <ResultSummary
              result={{
                committed: state.initializeResult.productsCreated,
                skipped: state.initializeResult.skipped,
                failed: state.initializeResult.failed,
                totalDelta: state.initializeResult.totalUnits,
                errors: state.initializeResult.errors,
              }}
              warehouseId={warehouseId}
              warehouseName={warehouseName}
              filename={
                state.filenameLabel || (state.file?.name ?? "import.xlsx")
              }
              mode={state.mode}
              onNewImport={handleReset}
            />
          ) : state.commitResult ? (
            <ResultSummary
              result={state.commitResult}
              warehouseId={warehouseId}
              warehouseName={warehouseName}
              filename={
                state.filenameLabel || (state.file?.name ?? "import.xlsx")
              }
              mode={state.mode}
              onNewImport={handleReset}
            />
          ) : null)}
      </div>
    </div>
  );
}
