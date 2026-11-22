"use client";

/**
 * Cendaro — Catalog Import Wizard (Zero-Template Multi-File + Semantic RAG)
 *
 * Main orchestrator connecting all 6 steps via state machine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Icons } from "@cendaro/ui/icons";

import type { CatalogImportStep } from "./hooks/use-catalog-import";
import type { ParsedCatalogRow } from "./lib/catalog-validators";
import { formatPlural } from "~/lib/plural";
import { useTRPC } from "~/trpc/client";
import { useCatalogImport } from "./hooks/use-catalog-import";
import { useParseCatalogFile } from "./hooks/use-parse-catalog-file";
import { parseRow } from "./lib/catalog-validators";
import { CategoryMappingStep } from "./steps/category-mapping";
import { DryRunSummary } from "./steps/dry-run-summary";
import { FileUpload } from "./steps/file-upload";
import { HeaderMapping } from "./steps/header-mapping";
import { ResultSummary } from "./steps/result-summary";
import { ValidationPreview } from "./steps/validation-preview";

const STORAGE_KEY = "cendaro-catalog-import-wizard";

const CLIENT_SAFE_STEPS = new Set(["upload", "header-mapping", "validation"]);

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
          "flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs font-medium transition-all";
        const colorClasses = isActive
          ? "bg-primary text-primary-foreground"
          : isDone
            ? "bg-status-success-bg text-status-success-fg"
            : "bg-muted text-muted-foreground";

        return (
          <div key={s.key} className="flex items-center gap-1">
            {isDone ? (
              <button
                type="button"
                onClick={() => onStepClick(s.key)}
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
                {s.num}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            )}
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-4 transition-colors sm:w-8 ${
                  currentNum > s.num ? "bg-status-success-fg" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CatalogImportWizard() {
  const trpc = useTRPC();

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
    updateValidatedRowSku,
    setLoading,
    setError,
    goToStep,
    restoreState,
    reset,
  } = useCatalogImport();

  const hasRestored = useRef(false);
  const [wasRestored, setWasRestored] = useState(false);
  const [isMatchingSemantic, setIsMatchingSemantic] = useState(false);

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<typeof state>;
      if (parsed.step && parsed.step !== "upload") {
        const safeStep = CLIENT_SAFE_STEPS.has(parsed.step)
          ? parsed.step
          : "validation";

        restoreState({
          ...parsed,
          step: safeStep,
          idempotencyKey: crypto.randomUUID(),
          sessionId: null,
          unresolvedCategories: [],
          importResult: null,
        });
        setWasRestored(true);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [restoreState]);

  useEffect(() => {
    if (state.step === "upload") return;

    if (!CLIENT_SAFE_STEPS.has(state.step)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    try {
      const {
        isLoading: _l,
        serverError: _e,
        importResult: _r,
        sessionId: _s,
        unresolvedCategories: _u,
        ...persistable
      } = state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [state]);

  const {
    error: parseError,
    isParsing,
    parseFiles,
    reset: resetParser,
  } = useParseCatalogFile();

  const { data: categories } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const { data: brands } = useQuery(trpc.catalog.listBrands.queryOptions());
  const { data: suppliers } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );

  // Zero-Template AI & Semantic RAG mutations
  const matchCatalogMutation = useMutation(
    trpc.aiImport.matchCatalogItems.mutationOptions(),
  );
  const saveProfileMutation = useMutation(
    trpc.aiImport.saveTemplateProfile.mutationOptions(),
  );

  const enrichRowsWithSemanticMatch = useCallback(
    async (rows: ParsedCatalogRow[]): Promise<ParsedCatalogRow[]> => {
      if (rows.length === 0) return rows;
      setIsMatchingSemantic(true);
      try {
        const enriched = [...rows];
        const BATCH_SIZE = 1500;
        for (let start = 0; start < rows.length; start += BATCH_SIZE) {
          const slice = rows.slice(start, start + BATCH_SIZE);
          const matches = await matchCatalogMutation.mutateAsync({
            targetDomain: "catalog",
            items: slice.map((r) => ({
              sku: r.sku || undefined,
              skuAutoGenerated: r.skuAutoGenerated,
              name: r.name || r.sku || "Producto",
              barcode: r.barcode,
              categoryRaw: r.categoryRaw,
              brandRaw: r.brandRaw,
            })),
          });

          for (const m of matches) {
            const targetIdx = start + m.rowIndex;
            const current = enriched[targetIdx];
            if (!current) continue;

            // If SKU was auto-generated and semantic RRF confidently matched an existing SKU, link it!
            const linkedSku =
              current.skuAutoGenerated &&
              m.classification === "matched_existing" &&
              m.matchedProductSku
                ? m.matchedProductSku
                : current.sku;

            enriched[targetIdx] = {
              ...current,
              sku: linkedSku,
              skuAutoGenerated:
                linkedSku !== current.sku ? false : current.skuAutoGenerated,
              categoryRaw:
                current.categoryRaw ?? m.suggestedCategoryName ?? undefined,
              brandRaw: current.brandRaw ?? m.suggestedBrandName ?? undefined,
              semanticMatch: {
                classification: m.classification,
                matchedSku: m.matchedProductSku,
                matchedName: m.matchedProductName,
                confidence: m.confidence,
                matchMethod: m.matchMethod,
              },
            };
          }
        }
        return enriched;
      } catch {
        // Best-effort RAG enrichment; never block offline/degraded catalog validation
        return rows;
      } finally {
        setIsMatchingSemantic(false);
      }
    },
    [matchCatalogMutation],
  );

  // Create session — triggers validation on success
  const createSessionMutation = useMutation(
    trpc.catalogImport.create.mutationOptions({
      onSuccess: (result) => {
        onSessionCreated(result.sessionId);
        validateMutation.mutate({ sessionId: result.sessionId });
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        sessionStorage.removeItem(STORAGE_KEY);
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
            suggestedNewName: cat.suggestedNewName ?? null,
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
            `${formatPlural(result.unresolvedCategories.length, "categoría necesita", "categorías necesitan")} resolución manual`,
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

  // Commit + Persist Learned Template Profiles
  const commitMutation = useMutation(
    trpc.catalogImport.commit.mutationOptions({
      onSuccess: (result) => {
        onCommitComplete(result);
        const profiles = state.parseResult?.learnedProfilesToSave ?? [];
        for (const profile of profiles) {
          saveProfileMutation.mutate(profile);
        }

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

  const handleFilesSelect = async (
    files: File[],
    supplierId?: string | null,
  ) => {
    const result = await parseFiles(files, { supplierId });
    if (!result) return;

    onFileParsed(result);

    if (result.autoAdvanceToValidation) {
      const enriched = await enrichRowsWithSemanticMatch(result.parsedRows);
      // Pass undefined for rawDataRows so enriched semantic fields are preserved
      onValidate(enriched, result.headerMap);
    }
  };

  const handleConfirmMapping = async () => {
    if (!state.parseResult) return;

    let candidateRows = state.parseResult.parsedRows;
    if (
      state.parseResult.rawDataRows &&
      state.parseResult.rawDataRows.length > 0 &&
      !state.parseResult.isMultiSchemaBatch
    ) {
      const reparsed: ParsedCatalogRow[] = [];
      const hIdx = state.parseResult.headerIndex ?? 0;
      for (let i = 0; i < state.parseResult.rawDataRows.length; i++) {
        const row = state.parseResult.rawDataRows[i];
        if (!row) continue;
        const parsed = parseRow(row, state.headerMap, hIdx + i + 2);
        if (parsed) reparsed.push(parsed);
      }
      candidateRows = reparsed;
    }

    const enriched = await enrichRowsWithSemanticMatch(candidateRows);
    onValidate(enriched, state.headerMap);
  };

  const handleProceedFromValidation = () => {
    if (!state.parseResult || state.validatedRows.length === 0) return;

    setLoading(true);

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
  };

  const handleCategoryMappingComplete = () => {
    if (!state.sessionId) return;

    setLoading(true);

    const mappings = state.unresolvedCategories.map((c) => ({
      rawCategory: c.rawCategory,
      resolvedCategoryId: c.resolvedCategoryId,
      newCategoryName: c.newCategoryName,
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
    sessionStorage.removeItem(STORAGE_KEY);
    setWasRestored(false);
  };

  const stepNum = getStepNum(state.step);

  return (
    <div className="space-y-6 py-4 lg:py-8" role="tabpanel">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/catalog"
          className="hover:text-foreground transition-colors"
        >
          Catálogo
        </Link>
        <Icons.ChevronRight className="size-4" />
        <span className="text-foreground font-medium">Importar</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-xl font-medium tracking-tight">
          Importar Catálogo
        </h1>
        {state.step !== "result" && (
          <button
            type="button"
            onClick={handleReset}
            disabled={state.isLoading || isParsing || isMatchingSemantic}
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
        onStepClick={(step) => {
          if (getStepNum(step) < stepNum) {
            goToStep(step);
          }
        }}
      />

      {/* Global error */}
      {state.serverError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-xs">
          <Icons.Error className="size-4 shrink-0" />
          {state.serverError}
        </div>
      )}

      {/* Restored session banner */}
      {wasRestored && state.step !== "upload" && state.step !== "result" && (
        <div className="border-status-warning-fg/30 bg-status-warning-bg text-status-warning-fg flex items-center justify-between gap-2 border px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <Icons.Restore className="size-4" />
            Sesión restaurada — los datos de tu archivo ya están cargados.
          </div>
          <button
            type="button"
            onClick={() => setWasRestored(false)}
            className="text-status-warning-fg hover:text-foreground transition-colors"
          >
            <Icons.Close className="size-4" />
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-75">
        {state.step === "upload" && (
          <FileUpload
            onFilesSelect={handleFilesSelect}
            isParsing={isParsing || isMatchingSemantic}
            error={parseError?.message ?? null}
            brands={brands?.map((b) => ({ id: b.id, name: b.name })) ?? []}
            categories={
              categories?.map((c) => ({ id: c.id, name: c.name })) ?? []
            }
            suppliers={
              suppliers?.map((s) => ({ id: s.id, name: s.name })) ?? []
            }
          />
        )}

        {state.step === "header-mapping" && state.parseResult && (
          <HeaderMapping
            headers={state.parseResult.headers}
            headerMap={state.headerMap}
            unmapped={state.parseResult.unmapped}
            sheetName={state.parseResult.sheetName}
            totalRows={state.parseResult.parsedRows.length + 1}
            aiSummary={state.parseResult.aiSummary}
            isMultiSchemaBatch={state.parseResult.isMultiSchemaBatch}
            isMatchingSemantic={isMatchingSemantic}
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
            aiSummary={state.parseResult?.aiSummary}
            onUpdateRowSku={updateValidatedRowSku}
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
            onBack={() =>
              goToStep(
                state.unresolvedCategories.length > 0
                  ? "category-mapping"
                  : "validation",
              )
            }
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
