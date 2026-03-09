"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";

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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: "Creado", color: "bg-secondary text-muted-foreground", icon: "draft" },
  in_transit: { label: "En Tránsito", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", icon: "directions_boat" },
  received: { label: "Recibido", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400", icon: "move_to_inbox" },
  closed: { label: "Cerrado", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400", icon: "check_circle" },
};

export default function ContainerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();

  // ── State ────────────────────────────────────────────
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [aiStatus, setAiStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [aiProgress, setAiProgress] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────
  const { data: container, isLoading, refetch } = useQuery(
    trpc.container.byId.queryOptions({ id }),
  );

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
  const handleFile = useCallback(async (file: File) => {
    setAiStatus("uploading");
    setAiError("");
    setAiProgress("Subiendo archivo...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("containerId", id);

      setAiStatus("processing");
      setAiProgress(`Procesando ${file.name} con IA...`);

      const response = await fetch("/api/ai/parse-packing-list", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage: string;
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const err = (await response.json()) as { error?: string };
          errorMessage = err.error ?? `Error del servidor (${response.status})`;
        } else {
          const text = await response.text();
          errorMessage = text.length > 200
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
        `✅ ${data.itemCount} items procesados de ${data.totalRows} filas (${data.totalChunks} lotes)` +
        (data.failedChunks.length > 0 ? ` · ⚠ ${data.failedChunks.length} lotes fallaron` : "") +
        ` · Fuente: ${data.promptSource}`,
      );
    } catch (err) {
      setAiStatus("error");
      setAiError(err instanceof Error ? err.message : "Error desconocido");
      setAiProgress("");
    }
  }, [id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

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
        matchType: item.match_type === "ai_only" ? "ai_only" as const : item.match_type,
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
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <span className="material-symbols-outlined text-5xl mb-3">package_2</span>
        <p className="text-lg font-medium">Contenedor no encontrado</p>
        <Link href="/containers" className="mt-4 text-sm text-primary hover:underline">← Volver a contenedores</Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[container.status] ?? { label: container.status, color: "", icon: "draft" };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/containers" className="hover:text-foreground transition-colors">Contenedores</Link>
        <span className="material-symbols-outlined text-base">chevron_right</span>
        <span className="font-medium text-foreground">{container.containerNumber}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-muted-foreground">{cfg.icon}</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-mono">{container.containerNumber}</h1>
              <p className="text-sm text-muted-foreground">Contenedor de importación</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Estado", value: cfg.label, icon: "flag" },
          { label: "Costo FOB", value: `$${Number(container.costFob ?? 0).toLocaleString()}`, icon: "attach_money" },
          { label: "Salida", value: container.departureDate ? new Date(container.departureDate).toLocaleDateString("es-VE") : "—", icon: "flight_takeoff" },
          { label: "Llegada", value: container.arrivalDate ? new Date(container.arrivalDate).toLocaleDateString("es-VE") : "—", icon: "flight_land" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Packing List Section */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-linear-to-r from-violet-600/10 to-blue-600/10 p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500">smart_toy</span>
            <h2 className="font-bold">PACKING LIST — IA</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Procesamiento con Qwen3-32B vía Groq</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Drop Zone */}
          {aiStatus !== "done" && (
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              {aiStatus === "idle" && (
                <>
                  <span className="material-symbols-outlined text-4xl text-muted-foreground mb-2">upload_file</span>
                  <p className="text-sm text-muted-foreground">Arrastra un packing list aquí o</p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    <span className="material-symbols-outlined text-base">folder_open</span>
                    Seleccionar archivo
                    <input type="file" accept=".xlsx,.xls,.pdf" onChange={handleInputChange} className="hidden" />
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">Formatos: Excel (.xlsx/.xls), PDF</p>
                </>
              )}
              {(aiStatus === "uploading" || aiStatus === "processing") && (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm font-medium text-primary">{aiProgress}</p>
                </div>
              )}
              {aiStatus === "error" && (
                <div className="flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-3xl text-red-500">error</span>
                  <p className="text-sm font-medium text-red-500">Error al procesar</p>
                  <p className="text-xs text-red-400">{aiError}</p>
                  <button onClick={() => setAiStatus("idle")} className="mt-1 text-xs text-primary hover:underline">
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stats Bar */}
          {aiStats && parsedItems.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {[
                { label: "Matcheados", value: aiStats.matched, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Revisar", value: aiStats.review, color: "text-amber-600 dark:text-amber-400" },
                { label: "Nuevos", value: aiStats.newItems, color: "text-blue-600 dark:text-blue-400" },
                { label: "Alta Conf.", value: aiStats.highConfidence, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Media Conf.", value: aiStats.mediumConfidence, color: "text-amber-600 dark:text-amber-400" },
                { label: "Baja Conf.", value: aiStats.lowConfidence, color: "text-red-600 dark:text-red-400" },
                { label: "📷 Extraídas", value: aiStats.imagesExtracted, color: "text-violet-600 dark:text-violet-400" },
                { label: "🤖 Analizadas", value: aiStats.imagesAnalyzed, color: "text-violet-600 dark:text-violet-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border p-2 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {aiStatus === "done" && aiProgress && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{aiProgress}</p>
          )}

          {/* Results Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  Items Procesados ({parsedItems.length})
                </h3>
                <button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {confirmMutation.isPending ? "Guardando..." : "Confirmar Importación"}
                </button>
              </div>

              <div className="max-h-[600px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">#</th>
                      <th className="px-2 py-2 text-center font-bold text-muted-foreground">📷</th>
                      <th className="px-2 py-2 text-center font-bold text-muted-foreground">Conf.</th>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">Original</th>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">Traducción (ES)</th>
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">Cant.</th>
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">Costo</th>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">SKU</th>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">Categoría</th>
                      <th className="px-3 py-2 text-left font-bold text-muted-foreground">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedItems.map((item, i) => {
                      const badge = item.confidence >= 90
                        ? { icon: "🟢", cls: "text-emerald-600" }
                        : item.confidence >= 60
                          ? { icon: "🟡", cls: "text-amber-600" }
                          : { icon: "🔴", cls: "text-red-600" };
                      return (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{i + 1}</td>
                          <td className="px-2 py-2 text-center">
                            {item.image_url ? (
                              <button
                                onClick={() => setZoomImage(item.image_url)}
                                className="block rounded border border-border overflow-hidden hover:ring-2 hover:ring-violet-500/50 transition-all"
                                title={item.image_description ?? "Ver imagen"}
                              >
                                <Image src={item.image_url} alt="" width={40} height={40} className="h-10 w-10 object-cover" unoptimized />
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center" title={`Confianza: ${item.confidence}%`}>
                            <span className={`text-sm ${badge.cls}`}>{badge.icon}</span>
                            <span className="ml-1 text-[10px] font-mono text-muted-foreground">{item.confidence}%</span>
                          </td>
                          <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={item.original_name}>
                            {item.original_name}
                          </td>
                          <td className="px-3 py-2">
                            {editingIndex === i ? (
                              <input
                                autoFocus
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                                defaultValue={item.name_es}
                                onBlur={(e) => { updateTranslation(i, e.target.value); setEditingIndex(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              />
                            ) : (
                              <button onClick={() => setEditingIndex(i)} className="text-left text-xs hover:text-primary transition-colors" title="Click para editar">
                                {item.name_es}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {item.unit_cost != null ? `$${item.unit_cost.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{item.sku_hint ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{item.category_hint ?? "—"}</td>
                          <td className="px-3 py-2">
                            {item.match_type === "exact_sku" && (
                              <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">SKU ✓</span>
                            )}
                            {item.match_type === "name_similarity" && (
                              <span className="rounded bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                ~{item.match_confidence}%
                              </span>
                            )}
                            {item.match_type === "no_match" && (
                              <span className="rounded bg-red-100 dark:bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">Nuevo</span>
                            )}
                            {item.match_type === "ai_only" && (
                              <span className="rounded bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">IA</span>
                            )}
                            {item.suggested_product_name && (
                              <p className="mt-0.5 text-[10px] text-muted-foreground truncate max-w-[150px]" title={item.suggested_product_name}>
                                → {item.suggested_product_name}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Información del Contenedor</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Número", value: container.containerNumber },
            { label: "Estado", value: cfg.label },
            { label: "Costo FOB", value: `$${Number(container.costFob ?? 0).toLocaleString()}` },
            { label: "Fecha Salida", value: container.departureDate ? new Date(container.departureDate).toLocaleDateString("es-VE") : "—" },
            { label: "Fecha Llegada", value: container.arrivalDate ? new Date(container.arrivalDate).toLocaleDateString("es-VE") : "—" },
            { label: "Creado", value: new Date(container.createdAt).toLocaleDateString("es-VE") },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{d.label}</span>
              <span className="text-sm font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
