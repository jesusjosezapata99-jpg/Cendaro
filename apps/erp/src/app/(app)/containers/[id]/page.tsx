"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

// ── Types ──────────────────────────────────────────────
interface ParsedItem {
  original_name: string;
  name_es: string;
  quantity: number;
  unit_cost: number | null;
  weight_kg: number | null;
  sku_hint: string | null;
  category_hint: string | null;
  confidence: number;
  suggested_product_id: string | null;
  suggested_product_name: string | null;
  match_confidence: number;
  match_type: "exact_sku" | "name_similarity" | "ai_only" | "no_match";
  image_url: string | null;
  image_description: string | null;
}

interface AIStats {
  matched: number;
  review: number;
  newItems: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  imagesExtracted: number;
  imagesAnalyzed: number;
}

interface AIResponse {
  success: boolean;
  containerId: string;
  totalRows: number;
  totalChunks: number;
  failedChunks: number[];
  itemCount: number;
  items: ParsedItem[];
  stats: AIStats;
  promptSource: string;
}

// ── Skeleton ───────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

// ── Status Config ──────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  created: {
    label: "Creado",
    color: "bg-secondary text-muted-foreground",
    icon: "draft",
  },
  in_transit: {
    label: "En Tránsito",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
    icon: "directions_boat",
  },
  received: {
    label: "Recibido",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: "move_to_inbox",
  },
  closed: {
    label: "Cerrado",
    color:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    icon: "check_circle",
  },
};

const ACCEPTED_FORMATS = ".xlsx,.xls,.pdf";

export default function ContainerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ────────────────────────────────────────────
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [aiStatus, setAiStatus] = useState<
    "idle" | "uploading" | "processing" | "done" | "error"
  >("idle");
  const [aiProgress, setAiProgress] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────
  const {
    data: container,
    isLoading,
    refetch,
  } = useQuery(trpc.container.byId.queryOptions({ id }));

  const confirmMutation = useMutation(
    trpc.container.confirmWithMatching.mutationOptions({
      onSuccess: () => {
        setParsedItems([]);
        setAiStatus("idle");
        setAiStats(null);
        void refetch();
      },
    }),
  );

  // ── File Upload Handler ──────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      setAiStatus("uploading");
      setAiError("");
      setAiProgress("Validando archivo...");

      try {
        // ── Client-side validation ──
        if (file.size > 500 * 1024 * 1024) {
          throw new Error("Archivo demasiado grande (máximo 500MB)");
        }

        const isExcel = /\.(xlsx|xls)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);

        if (!isExcel && !isPdf) {
          throw new Error("Formato no soportado. Use Excel (.xlsx/.xls) o PDF");
        }

        setAiStatus("processing");

        if (isExcel) {
          // ═══ EXCEL PATH: Tier 1+2 — Parse text → chunk → sequential API ═══
          setAiProgress("📄 Leyendo archivo Excel en el navegador...");
          const { parseAndChunkExcel } =
            await import("~/lib/parse-file-browser");
          const { chunks, totalRows, totalChunks } =
            await parseAndChunkExcel(file);

          if (totalRows === 0) {
            throw new Error(
              "El archivo Excel está vacío o no contiene datos válidos",
            );
          }

          setAiProgress(
            `📊 ${totalRows.toLocaleString()} filas extraídas → ${totalChunks} lotes de ≤2MB`,
          );

          // ── Sequential chunked upload ──
          const allItems: ParsedItem[] = [];
          const failedChunks: number[] = [];
          let lastStats: AIStats | null = null;
          let lastPromptSource = "";

          for (let i = 0; i < chunks.length; i++) {
            // ── TPM rate limit delay between chunks ──
            // Groq free tier: 6K TPM for qwen3-32b.
            // Each chunk uses ~3K tokens (1600 input + 1400 output).
            // 30s delay = max 2 chunks/minute, safely fitting the 6K TPM budget.
            if (i > 0) {
              const delayMs = 30000;
              const delaySec = delayMs / 1000;
              for (let sec = delaySec; sec > 0; sec--) {
                setAiProgress(
                  `⏳ Esperando ${sec}s antes del lote ${i + 1}/${totalChunks} ` +
                    `(${allItems.length} items acumulados)...`,
                );
                await new Promise((r) => setTimeout(r, 1000));
              }
            }

            setAiProgress(
              `🤖 Procesando lote ${i + 1} de ${totalChunks} con IA ` +
                `(${allItems.length} items acumulados)...`,
            );

            // ── Retry loop with exponential backoff for 429 errors ──
            const maxRetries = 3;
            let chunkSuccess = false;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
              try {
                const response = await fetch("/api/ai/parse-packing-list", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    rows: chunks[i],
                    containerId: id,
                    chunkIndex: i,
                    totalChunks,
                  }),
                });

                if (response.status === 429) {
                  // Rate limited — wait and retry
                  const retryAfter = parseInt(
                    response.headers.get("retry-after") ?? "15",
                    10,
                  );
                  const waitSec = Math.max(retryAfter, 10) * (attempt + 1);
                  for (let sec = waitSec; sec > 0; sec--) {
                    setAiProgress(
                      `⚠️ API rate limit — reintentando lote ${i + 1} en ${sec}s...`,
                    );
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                  continue; // retry
                }

                if (!response.ok) {
                  const contentType =
                    response.headers.get("content-type") ?? "";
                  let errorDetail: string;
                  if (contentType.includes("application/json")) {
                    const err = (await response.json()) as { error?: string };
                    errorDetail = err.error ?? `HTTP ${response.status}`;
                  } else {
                    errorDetail =
                      (await response.text()).slice(0, 200) ||
                      `HTTP ${response.status}`;
                  }
                  console.warn(
                    `Chunk ${i + 1}/${totalChunks} failed: ${errorDetail}`,
                  );
                  if (attempt < maxRetries - 1) {
                    // Wait before retry
                    await new Promise((r) =>
                      setTimeout(r, 5000 * (attempt + 1)),
                    );
                    continue;
                  }
                  failedChunks.push(i);
                  break;
                }

                const data = (await response.json()) as AIResponse;
                allItems.push(...data.items);
                lastStats = data.stats;
                if (data.promptSource) lastPromptSource = data.promptSource;
                chunkSuccess = true;
                break; // success — exit retry loop
              } catch (chunkErr) {
                console.warn(
                  `Chunk ${i + 1}/${totalChunks} attempt ${attempt + 1} error:`,
                  chunkErr,
                );
                if (attempt < maxRetries - 1) {
                  await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
                  continue;
                }
                failedChunks.push(i);
              }
            }

            if (!chunkSuccess && !failedChunks.includes(i)) {
              failedChunks.push(i);
            }
          }

          // ── Merge results from all chunks ──
          if (allItems.length === 0 && failedChunks.length > 0) {
            throw new Error(
              `Todos los ${totalChunks} lotes fallaron. Revise la conexión o intente de nuevo.`,
            );
          }

          // Recalculate merged stats
          const mergedStats: AIStats = lastStats ?? {
            matched: 0,
            review: 0,
            newItems: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0,
            imagesExtracted: 0,
            imagesAnalyzed: 0,
          };
          // Aggregate counts from all accumulated items
          mergedStats.matched = allItems.filter(
            (i) => i.match_type !== "no_match",
          ).length;
          mergedStats.newItems = allItems.filter(
            (i) => i.match_type === "no_match",
          ).length;
          mergedStats.highConfidence = allItems.filter(
            (i) => i.confidence >= 0.8,
          ).length;
          mergedStats.mediumConfidence = allItems.filter(
            (i) => i.confidence >= 0.5 && i.confidence < 0.8,
          ).length;
          mergedStats.lowConfidence = allItems.filter(
            (i) => i.confidence < 0.5,
          ).length;

          setParsedItems(allItems);
          setAiStats(mergedStats);
          setAiStatus("done");
          setAiProgress(
            `✅ ${allItems.length} items procesados de ${totalRows.toLocaleString()} filas (${totalChunks} lotes)` +
              (failedChunks.length > 0
                ? ` · ⚠ ${failedChunks.length} lotes fallaron`
                : "") +
              (lastPromptSource ? ` · Fuente: ${lastPromptSource}` : ""),
          );
        } else {
          // ═══ PDF PATH: Upload via FormData (≤ 4MB) — unchanged ═══
          if (file.size > 4 * 1024 * 1024) {
            throw new Error(
              `PDF demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo para PDF: 4MB. Para archivos más grandes, convierte a Excel (.xlsx).`,
            );
          }

          setAiProgress(`📤 Subiendo ${file.name}...`);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("containerId", id);

          const response = await fetch("/api/ai/parse-packing-list", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            let errorMessage: string;
            const contentType = response.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
              const err = (await response.json()) as { error?: string };
              errorMessage =
                err.error ?? `Error del servidor (${response.status})`;
            } else {
              const text = await response.text();
              errorMessage =
                text.length > 200
                  ? `Error del servidor (${response.status}): ${text.slice(0, 200)}…`
                  : text || `Error del servidor (${response.status})`;
            }
            throw new Error(errorMessage);
          }

          const data = (await response.json()) as AIResponse;

          setParsedItems(data.items);
          setAiStats(data.stats);
          setAiStatus("done");
          setAiProgress(
            `✅ ${data.itemCount} items procesados de ${data.totalRows} filas` +
              ` · Fuente: ${data.promptSource}`,
          );
        }
      } catch (err) {
        setAiStatus("error");
        setAiError(err instanceof Error ? err.message : "Error desconocido");
        setAiProgress("");
      }
    },
    [id],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  // ── Confirm Import ───────────────────────────────────
  const handleConfirm = useCallback(() => {
    confirmMutation.mutate({
      containerId: id,
      items: parsedItems.map((item) => ({
        originalName: item.original_name,
        translatedName: item.name_es,
        quantity: item.quantity,
        unitCost: item.unit_cost,
        weightKg: item.weight_kg,
        skuHint: item.sku_hint,
        categoryHint: item.category_hint,
        confidence: item.confidence,
        suggestedProductId: item.suggested_product_id,
        matchType:
          item.match_type === "ai_only"
            ? ("ai_only" as const)
            : item.match_type,
        createProduct: false,
        aiCorrected: false,
        imageUrl: item.image_url ?? undefined,
        imageDescription: item.image_description ?? undefined,
      })),
    });
  }, [confirmMutation, id, parsedItems]);

  // ── Edit Translation ─────────────────────────────────
  const updateTranslation = useCallback((index: number, value: string) => {
    setParsedItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item) {
        next[index] = { ...item, name_es: value };
      }
      return next;
    });
  }, []);

  // ── Loading ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center p-12">
        <span className="material-symbols-outlined mb-3 text-5xl">
          package_2
        </span>
        <p className="text-lg font-medium">Contenedor no encontrado</p>
        <Link
          href="/containers"
          className="text-primary mt-4 text-sm hover:underline"
        >
          ← Volver a contenedores
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[container.status] ?? {
    label: container.status,
    color: "",
    icon: "draft",
  };
  const canUpload =
    container.status === "created" || container.status === "in_transit";

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/containers"
          className="hover:text-foreground transition-colors"
        >
          Contenedores
        </Link>
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
        <span className="text-foreground font-medium">
          {container.containerNumber}
        </span>
      </div>

      {/* Header */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-muted-foreground text-3xl">
              {cfg.icon}
            </span>
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {container.containerNumber}
              </h1>
              <p className="text-muted-foreground text-sm">
                Contenedor de importación
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.color}`}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Estado", value: cfg.label, icon: "flag" },
          {
            label: "Costo FOB",
            value: `$${Number(container.costFob ?? 0).toLocaleString()}`,
            icon: "attach_money",
          },
          {
            label: "Salida",
            value: container.departureDate
              ? new Date(container.departureDate).toLocaleDateString("es-VE")
              : "—",
            icon: "flight_takeoff",
          },
          {
            label: "Llegada",
            value: container.arrivalDate
              ? new Date(container.arrivalDate).toLocaleDateString("es-VE")
              : "—",
            icon: "flight_land",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ AI Packing List Section ═══ */}
      <section className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border flex items-center gap-3 border-b bg-linear-to-r from-violet-500/5 to-blue-500/5 p-4">
          <span className="material-symbols-outlined text-2xl text-violet-500">
            smart_toy
          </span>
          <div>
            <h2 className="text-sm font-bold tracking-widest uppercase">
              Packing List — IA
            </h2>
            <p className="text-muted-foreground text-xs">
              Procesamiento con Qwen3-32B vía Groq
            </p>
          </div>
          {container.packingListItemCount > 0 && (
            <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              {container.packingListItemCount} items importados
            </span>
          )}
        </div>

        <div className="space-y-4 p-4">
          {/* Upload Zone */}
          {canUpload && aiStatus !== "done" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? "border-violet-500 bg-violet-500/5"
                  : "border-border hover:bg-muted/50 hover:border-violet-300"
              } ${aiStatus === "processing" ? "pointer-events-none opacity-50" : ""} `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FORMATS}
                onChange={handleInputChange}
                className="hidden"
              />
              {aiStatus === "idle" && (
                <>
                  <span className="material-symbols-outlined text-muted-foreground mb-2 text-4xl">
                    cloud_upload
                  </span>
                  <p className="text-sm font-medium">
                    Arrastra tu packing list aquí
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Excel (.xlsx/.xls) o PDF — hasta 5000+ items
                  </p>
                </>
              )}
              {(aiStatus === "uploading" || aiStatus === "processing") && (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                    {aiProgress}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Traduciendo con Qwen3-32B... esto puede tomar 15-25 segundos
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {aiStatus === "error" && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/5">
              <span className="material-symbols-outlined text-red-500">
                error
              </span>
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Error al procesar
                </p>
                <p className="text-xs text-red-600 dark:text-red-300">
                  {aiError}
                </p>
                <button
                  onClick={() => {
                    setAiStatus("idle");
                    setAiError("");
                  }}
                  className="mt-2 text-xs font-medium text-red-600 underline hover:text-red-500"
                >
                  Intentar de nuevo
                </button>
              </div>
            </div>
          )}

          {/* Progress / Success */}
          {aiStatus === "done" && aiProgress && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <span className="material-symbols-outlined text-emerald-500">
                check_circle
              </span>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {aiProgress}
              </p>
            </div>
          )}

          {/* Stats Bar */}
          {aiStats && parsedItems.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {[
                {
                  label: "Matcheados",
                  value: aiStats.matched,
                  color: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Revisar",
                  value: aiStats.review,
                  color: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Nuevos",
                  value: aiStats.newItems,
                  color: "text-blue-600 dark:text-blue-400",
                },
                {
                  label: "Alta Conf.",
                  value: aiStats.highConfidence,
                  color: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Media Conf.",
                  value: aiStats.mediumConfidence,
                  color: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Baja Conf.",
                  value: aiStats.lowConfidence,
                  color: "text-red-600 dark:text-red-400",
                },
                {
                  label: "📷 Extraídas",
                  value: aiStats.imagesExtracted,
                  color: "text-violet-600 dark:text-violet-400",
                },
                {
                  label: "🤖 Analizadas",
                  value: aiStats.imagesAnalyzed,
                  color: "text-violet-600 dark:text-violet-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="border-border rounded-lg border p-2 text-center"
                >
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Parsed Items Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
                  Items Traducidos ({parsedItems.length})
                </h3>
                <button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-all ${
                    confirmMutation.isPending
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-linear-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500"
                  } `}
                >
                  {confirmMutation.isPending && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span className="material-symbols-outlined text-base">
                    database
                  </span>
                  Confirmar Importación
                </button>
              </div>

              {/* Table */}
              <div className="border-border overflow-x-auto rounded-lg border">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          #
                        </th>
                        <th className="text-muted-foreground px-2 py-2 text-center font-bold">
                          📷
                        </th>
                        <th className="text-muted-foreground px-2 py-2 text-center font-bold">
                          Conf.
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          Original
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          Traducción (ES)
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-right font-bold">
                          Cant.
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-right font-bold">
                          Costo
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          SKU
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          Categoría
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left font-bold">
                          Match
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {parsedItems.map((item, i) => {
                        const badge =
                          item.confidence >= 90
                            ? { icon: "🟢", cls: "text-emerald-600" }
                            : item.confidence >= 60
                              ? { icon: "🟡", cls: "text-amber-600" }
                              : { icon: "🔴", cls: "text-red-600" };
                        return (
                          <tr
                            key={i}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {item.image_url ? (
                                <button
                                  onClick={() => setZoomImage(item.image_url)}
                                  className="border-border block overflow-hidden rounded border transition-all hover:ring-2 hover:ring-violet-500/50"
                                  title={item.image_description ?? "Ver imagen"}
                                >
                                  <Image
                                    src={item.image_url}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 object-cover"
                                    unoptimized
                                  />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              className="px-2 py-2 text-center"
                              title={`Confianza: ${item.confidence}%`}
                            >
                              <span className={`text-sm ${badge.cls}`}>
                                {badge.icon}
                              </span>
                              <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                                {item.confidence}%
                              </span>
                            </td>
                            <td
                              className="max-w-[180px] truncate px-3 py-2"
                              title={item.original_name}
                            >
                              {item.original_name}
                            </td>
                            <td className="max-w-[180px] px-3 py-2">
                              {editingIndex === i ? (
                                <input
                                  type="text"
                                  value={item.name_es}
                                  onChange={(e) =>
                                    updateTranslation(i, e.target.value)
                                  }
                                  onBlur={() => setEditingIndex(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      setEditingIndex(null);
                                  }}
                                  autoFocus
                                  className="bg-background w-full rounded border border-violet-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingIndex(i)}
                                  className="w-full truncate text-left transition-colors hover:text-violet-600 dark:hover:text-violet-400"
                                  title="Haz clic para editar"
                                >
                                  {item.name_es}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.unit_cost != null
                                ? `$${item.unit_cost.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {item.sku_hint ? (
                                <span className="rounded bg-orange-100 px-1.5 py-0.5 font-mono text-xs text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                                  {item.sku_hint}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-muted-foreground px-3 py-2 text-xs">
                              {item.category_hint ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {item.match_type === "exact_sku" && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                  SKU ✓
                                </span>
                              )}
                              {item.match_type === "name_similarity" && (
                                <span
                                  className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                  title={item.suggested_product_name ?? ""}
                                >
                                  ~{item.match_confidence}%
                                </span>
                              )}
                              {(item.match_type === "no_match" ||
                                item.match_type === "ai_only") && (
                                <span className="text-muted-foreground text-xs">
                                  Nuevo
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Image Zoom Modal */}
          {zoomImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setZoomImage(null)}
            >
              <div className="relative max-h-[80vh] max-w-[90vw]">
                <Image
                  src={zoomImage}
                  alt="Producto"
                  width={800}
                  height={600}
                  className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                  unoptimized
                />
                <button
                  onClick={() => setZoomImage(null)}
                  className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Details */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
          Información del Contenedor
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Número", value: container.containerNumber },
            { label: "Estado", value: cfg.label },
            {
              label: "Costo FOB",
              value: `$${Number(container.costFob ?? 0).toLocaleString()}`,
            },
            {
              label: "Fecha Salida",
              value: container.departureDate
                ? new Date(container.departureDate).toLocaleDateString("es-VE")
                : "—",
            },
            {
              label: "Fecha Llegada",
              value: container.arrivalDate
                ? new Date(container.arrivalDate).toLocaleDateString("es-VE")
                : "—",
            },
            {
              label: "Creado",
              value: new Date(container.createdAt).toLocaleDateString("es-VE"),
            },
          ].map((d) => (
            <div
              key={d.label}
              className="border-border flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-muted-foreground text-sm">{d.label}</span>
              <span className="text-sm font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
