"use client";

/**
 * Cendaro — Inventory Import Wizard
 *
 * Main orchestrator connecting all 6 steps via state machine.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20, §22
 */
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { WarehouseProduct } from "./lib/inventory-template-builder";
import { useTRPC } from "~/trpc/client";
import { useInventoryImport } from "./hooks/use-inventory-import";
import { useParseInventoryFile } from "./hooks/use-parse-inventory-file";
import { useValidateInventory } from "./hooks/use-validate-inventory";
import { downloadInventoryTemplate } from "./lib/inventory-template-builder";
import { DryRunSummary } from "./steps/dry-run-summary";
import { FileUpload } from "./steps/file-upload";
import { HeaderMapping } from "./steps/header-mapping";
import { ModeSelect } from "./steps/mode-select";
import { ResultSummary } from "./steps/result-summary";
import { ValidationPreview } from "./steps/validation-preview";

// ── Step indicator ───────────────────────────────

const STEPS = [
  { num: 1, label: "Modo" },
  { num: 2, label: "Archivo" },
  { num: 3, label: "Columnas" },
  { num: 4, label: "Validación" },
  { num: 5, label: "Resumen" },
  { num: 6, label: "Resultado" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1" role="tablist">
      {STEPS.map((s, i) => {
        const isDone = current > s.num;
        const isActive = current === s.num;
        return (
          <div key={s.num} className="flex items-center gap-1">
            <div
              role="tab"
              aria-selected={isActive}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : isDone
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isDone ? (
                <span className="material-symbols-outlined text-xs">check</span>
              ) : (
                s.num
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-4 transition-colors sm:w-8 ${
                  current > s.num ? "bg-emerald-400" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Wizard ───────────────────────────────────────

interface InventoryImportWizardProps {
  warehouseId: string;
}

export function InventoryImportWizard({
  warehouseId,
}: InventoryImportWizardProps) {
  const trpc = useTRPC();

  // Fetch warehouse details
  const { data: warehouse } = useQuery(
    trpc.inventory.getWarehouseDetail.queryOptions({ id: warehouseId }),
  );

  const warehouseName = warehouse?.name ?? "Almacén";

  // State machine
  const {
    state,
    selectMode,
    parseComplete,
    updateHeaderMap,
    validationComplete,
    setForceLocked,
    setProcessing,
    commitComplete,
    setError,
    goToStep,
    reset,
  } = useInventoryImport(warehouseId, warehouseName);

  // Parse hook
  const {
    error: parseError,
    isParsing,
    parseFile,
    reset: resetParser,
  } = useParseInventoryFile();

  // Validate hook
  const { validate } = useValidateInventory();

  // Fetch products for validation (when entering step 3)
  const { data: products } = useQuery(
    trpc.inventoryImport.getWarehouseProducts.queryOptions({ warehouseId }),
  );

  // Commit mutation
  const commitMutation = useMutation(
    trpc.inventoryImport.commit.mutationOptions({
      onSuccess: (result) => {
        commitComplete(result);
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

  // ── Handlers ─────────────────────────────────

  const handleFileSelect = async (file: File) => {
    const result = await parseFile(file);
    if (result) {
      parseComplete({
        headers: result.headers,
        dataRows: result.dataRows,
        headerMap: result.headerMap,
        unmapped: result.unmapped,
        sheetName: result.sheetName,
      });
    }
  };

  const handleConfirmMapping = () => {
    if (!state.mode || !products) return;

    // Run validation
    const validated = validate(
      state.rawRows,
      state.headerMap,
      products,
      state.mode,
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

    // Filter rows: valid + (locked if forceLocked)
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
      filename: state.file?.name ?? "import.xlsx",
      idempotencyKey: state.idempotencyKey,
      forceLocked: state.forceLocked,
    });
  };

  const handleDownloadTemplate = () => {
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
  };

  // ── Render ───────────────────────────────────

  return (
    <div className="space-y-6 p-4 lg:p-8" role="tabpanel">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/inventory"
          className="hover:text-foreground transition-colors"
        >
          Inventario
        </Link>
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
        <Link
          href={`/inventory/warehouse/${warehouseId}`}
          className="hover:text-foreground transition-colors"
        >
          {warehouseName}
        </Link>
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
        <span className="text-foreground font-medium">Importar</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Importar Inventario
        </h1>
        {state.step < 6 && (
          <button
            onClick={handleReset}
            disabled={state.isProcessing}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">
              restart_alt
            </span>
            Reiniciar
          </button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator current={state.step} />

      {/* Global error */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          {state.error}
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[300px]">
        {state.step === 1 && (
          <ModeSelect selectedMode={state.mode} onSelect={selectMode} />
        )}

        {state.step === 2 && state.mode && (
          <FileUpload
            mode={state.mode}
            onFileSelect={handleFileSelect}
            isParsing={isParsing}
            error={parseError?.message ?? null}
            onDownloadTemplate={handleDownloadTemplate}
          />
        )}

        {state.step === 3 && (
          <HeaderMapping
            headers={state.headers}
            headerMap={state.headerMap}
            unmapped={state.unmapped}
            sheetName={state.sheetName}
            totalRows={state.rawRows.length + 1}
            onUpdateMap={updateHeaderMap}
            onConfirm={handleConfirmMapping}
          />
        )}

        {state.step === 4 && state.mode && state.validationStats && (
          <ValidationPreview
            validatedRows={state.validatedRows}
            stats={state.validationStats}
            mode={state.mode}
            onProceed={() => {
              // Advance to dry-run summary (step 5)
              goToStep(5);
            }}
            onBack={() => handleReset()}
          />
        )}

        {state.step === 5 && state.mode && (
          <DryRunSummary
            validatedRows={state.validatedRows}
            mode={state.mode}
            warehouseName={warehouseName}
            forceLocked={state.forceLocked}
            onSetForceLocked={setForceLocked}
            onConfirm={handleConfirmImport}
            onBack={() => handleReset()}
            isProcessing={state.isProcessing}
            canForceLock={true}
          />
        )}

        {state.step === 6 && state.commitResult && (
          <ResultSummary
            result={state.commitResult}
            warehouseId={warehouseId}
            warehouseName={warehouseName}
            filename={state.file?.name ?? "import.xlsx"}
            onNewImport={handleReset}
          />
        )}
      </div>
    </div>
  );
}
