"use client";

/**
 * Cendaro — Catalog Import Wizard
 *
 * Main orchestrator connecting all 6 steps via state machine.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11, §21
 */
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CatalogImportStep } from "./hooks/use-catalog-import";
import { useTRPC } from "~/trpc/client";
import { useCatalogImport } from "./hooks/use-catalog-import";
import { useParseCatalogFile } from "./hooks/use-parse-catalog-file";
import { CategoryMappingStep } from "./steps/category-mapping";
import { DryRunSummary } from "./steps/dry-run-summary";
import { FileUpload } from "./steps/file-upload";
import { HeaderMapping } from "./steps/header-mapping";
import { ResultSummary } from "./steps/result-summary";
import { ValidationPreview } from "./steps/validation-preview";

// ── Step indicator ───────────────────────────────

const STEPS: {
  key: CatalogImportStep;
  num: number;
  label: string;
}[] = [
  { key: "upload", num: 1, label: "Archivo" },
  { key: "header-mapping", num: 2, label: "Columnas" },
  { key: "validation", num: 3, label: "Validación" },
  { key: "category-mapping", num: 4, label: "Categorías" },
  { key: "dry-run", num: 5, label: "Resumen" },
  { key: "result", num: 6, label: "Resultado" },
];

function getStepNum(step: CatalogImportStep): number {
  return STEPS.find((s) => s.key === step)?.num ?? 1;
}

function StepIndicator({
  current,
  onStepClick,
}: {
  current: CatalogImportStep;
  onStepClick: (step: CatalogImportStep) => void;
}) {
  const currentNum = getStepNum(current);

  return (
    <div className="flex items-center justify-center gap-1" role="tablist">
      {STEPS.map((s, i) => {
        const isDone = currentNum > s.num;
        const isActive = current === s.key;

        const sharedClasses =
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all";
        const colorClasses = isActive
          ? "bg-primary text-white"
          : isDone
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-muted text-muted-foreground";

        return (
          <div key={s.key} className="flex items-center gap-1">
            {isDone ? (
              <button
                onClick={() => onStepClick(s.key)}
                className={`${sharedClasses} ${colorClasses} cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95`}
                title={`Volver a ${s.label}`}
              >
                <span className="material-symbols-outlined text-xs">check</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ) : (
              <div
                role="tab"
                aria-selected={isActive}
                className={`${sharedClasses} ${colorClasses} ${!isActive ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {s.num}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            )}
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-4 transition-colors sm:w-8 ${
                  currentNum > s.num ? "bg-emerald-400" : "bg-border"
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

export function CatalogImportWizard() {
  const trpc = useTRPC();

  // State machine
  const {
    state,
    onFileParsed,
    onHeaderMapUpdated,
    onValidate,
    onSessionCreated,
    onCategoriesResolved,
    onCategoryMappingUpdated,
    onCategoryMappingComplete,
    onCommitComplete,
    setLoading,
    setError,
    goToStep,
    reset,
  } = useCatalogImport();

  // Parse hook
  const {
    error: parseError,
    isParsing,
    parseFile,
    reset: resetParser,
  } = useParseCatalogFile();

  // Fetch existing categories for mapping step
  const { data: categories } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );

  // ── Server mutations ─────────────────────────

  // Create session — triggers validation on success
  const createSessionMutation = useMutation(
    trpc.catalogImport.create.mutationOptions({
      onSuccess: (result) => {
        onSessionCreated(result.sessionId);
        // Trigger server-side validation immediately
        validateMutation.mutate({ sessionId: result.sessionId });
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        toast.error("Error al crear sesión: " + err.message);
      },
    }),
  );

  // Validate (server-side)
  const validateMutation = useMutation(
    trpc.catalogImport.validate.mutationOptions({
      onSuccess: (result) => {
        onCategoriesResolved(
          result.unresolvedCategories.map((cat) => ({
            rawCategory: cat.rawCategory,
            resolvedCategoryId: null,
            resolvedCategoryName: null,
            matchType: "fuzzy" as const,
            suggestions: cat.suggestions,
          })),
        );
        setLoading(false);
        if (result.unresolvedCategories.length === 0) {
          toast.success(
            "Validación completada — todas las categorías resueltas",
          );
        } else {
          toast.info(
            `${result.unresolvedCategories.length} categoría(s) necesitan resolución manual`,
          );
        }
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        toast.error("Error en validación: " + err.message);
      },
    }),
  );

  // Resolve categories (server-side)
  const resolveCategoriesMutation = useMutation(
    trpc.catalogImport.resolveCategories.mutationOptions({
      onSuccess: () => {
        onCategoryMappingComplete();
        setLoading(false);
        toast.success("Categorías resueltas — aliases guardados");
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        toast.error("Error al resolver categorías: " + err.message);
      },
    }),
  );

  // Dry run (server-side)
  const dryRunQuery = useQuery({
    ...trpc.catalogImport.dryRun.queryOptions({
      sessionId: state.sessionId ?? "",
    }),
    enabled: state.step === "dry-run" && !!state.sessionId,
  });

  // Commit
  const commitMutation = useMutation(
    trpc.catalogImport.commit.mutationOptions({
      onSuccess: (result) => {
        onCommitComplete(result);
        if (result.failed === 0) {
          toast.success(
            `Importación completada: ${result.inserted + result.updated} productos procesados`,
          );
        } else {
          toast.warning(
            `Importación parcial: ${result.inserted + result.updated} éxitos, ${result.failed} fallos`,
          );
        }
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        toast.error("Error al importar: " + err.message);
      },
    }),
  );

  // ── Handlers ─────────────────────────

  const handleFileSelect = async (file: File) => {
    const result = await parseFile(file);
    if (result) {
      onFileParsed(result);
    }
  };

  const handleConfirmMapping = () => {
    if (!state.parseResult) return;

    // Re-parse rows with potentially edited header map
    const parsedRows = state.parseResult.parsedRows.map((row, idx) => ({
      ...row,
      rowNumber: idx + 2,
    }));

    onValidate(parsedRows, state.headerMap);
  };

  const handleProceedFromValidation = () => {
    if (!state.parseResult || state.validatedRows.length === 0) return;

    setLoading(true);

    // Create session + upload rows to server
    createSessionMutation.mutate({
      filename: state.parseResult.filename,
      idempotencyKey: state.idempotencyKey,
      rows: state.validatedRows
        .filter((r) => r.status !== "error")
        .map((r) => ({
          rowNumber: r.rowNumber,
          sku: r.sku,
          name: r.name,
          categoryRaw: r.categoryRaw,
          brandRaw: r.brandRaw,
          cost: r.cost,
          quantity: r.quantity,
          barcode: r.barcode,
          weight: r.weight,
          volume: r.volume,
          description: r.description,
        })),
    });

    // Once session is created, trigger validation
    // (handled by session creation success callback -> validate mutation)
  };

  const handleCategoryMappingComplete = () => {
    if (!state.sessionId) return;

    setLoading(true);

    // Send resolved mappings to server
    const mappings = state.unresolvedCategories.map((c) => ({
      rawCategory: c.rawCategory,
      resolvedCategoryId: c.resolvedCategoryId,
      matchType: c.matchType,
      confidence: c.confidence,
    }));

    resolveCategoriesMutation.mutate({
      sessionId: state.sessionId,
      mappings,
    });
  };

  const handleCommit = () => {
    if (!state.sessionId) return;
    setLoading(true);
    commitMutation.mutate({
      sessionId: state.sessionId,
    });
  };

  const handleReset = () => {
    reset();
    resetParser();
  };

  const stepNum = getStepNum(state.step);

  // ── Render ─────────────────────────────────

  return (
    <div className="space-y-6 p-4 lg:p-8" role="tabpanel">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/catalog"
          className="hover:text-foreground transition-colors"
        >
          Catálogo
        </Link>
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
        <span className="text-foreground font-medium">Importar</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Importar Catálogo
        </h1>
        {state.step !== "result" && (
          <button
            onClick={handleReset}
            disabled={state.isLoading}
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
      <StepIndicator
        current={state.step}
        onStepClick={(step) => {
          if (getStepNum(step) < stepNum) {
            goToStep(step);
          }
        }}
      />

      {/* Global error */}
      {state.serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          {state.serverError}
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[300px]">
        {state.step === "upload" && (
          <FileUpload
            onFileSelect={handleFileSelect}
            isParsing={isParsing}
            error={parseError?.message ?? null}
          />
        )}

        {state.step === "header-mapping" && state.parseResult && (
          <HeaderMapping
            headers={state.parseResult.headers}
            headerMap={state.headerMap}
            unmapped={state.parseResult.unmapped}
            sheetName={state.parseResult.sheetName}
            totalRows={state.parseResult.parsedRows.length + 1}
            onUpdateMap={onHeaderMapUpdated}
            onConfirm={handleConfirmMapping}
          />
        )}

        {state.step === "validation" && (
          <ValidationPreview
            validatedRows={state.validatedRows}
            validCount={state.validCount}
            warningCount={state.warningCount}
            errorCount={state.errorCount}
            onProceed={handleProceedFromValidation}
            onBack={() => goToStep("header-mapping")}
          />
        )}

        {state.step === "category-mapping" && (
          <CategoryMappingStep
            unresolvedCategories={state.unresolvedCategories}
            existingCategories={
              categories?.map((c) => ({ id: c.id, name: c.name })) ?? []
            }
            onUpdateMapping={onCategoryMappingUpdated}
            onComplete={handleCategoryMappingComplete}
            onBack={() => goToStep("validation")}
            isLoading={state.isLoading}
          />
        )}

        {state.step === "dry-run" && (
          <DryRunSummary
            insertCount={dryRunQuery.data?.inserts ?? 0}
            updateCount={dryRunQuery.data?.updates ?? 0}
            skipCount={dryRunQuery.data?.skips ?? 0}
            errorCount={state.errorCount}
            onCommit={handleCommit}
            onBack={() => goToStep("category-mapping")}
            isCommitting={state.isLoading}
          />
        )}

        {state.step === "result" && state.importResult && (
          <ResultSummary
            result={state.importResult}
            onNewImport={handleReset}
          />
        )}
      </div>
    </div>
  );
}
