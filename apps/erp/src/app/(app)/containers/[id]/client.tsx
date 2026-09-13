"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
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

// ── Status Config ──────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; tone: StatusTone; icon: IconName }
> = {
  created: {
    label: "Creado",
    tone: "neutral",
    icon: "Draft",
  },
  in_transit: {
    label: "En Tránsito",
    tone: "primary",
    icon: "DirectionsBoat",
  },
  received: {
    label: "Recibido",
    tone: "warning",
    icon: "MoveToInbox",
  },
  closed: {
    label: "Cerrado",
    tone: "success",
    icon: "CheckCircle",
  },
};

const ACCEPTED_FORMATS = ".xlsx,.xls,.pdf";

export default function ContainerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();
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
        toast.success("Packing list importado correctamente");
        setParsedItems([]);
        setAiStatus("idle");
        setAiStats(null);
        void refetch();
        void qc.invalidateQueries({ queryKey: [["container"]] });
      },
      onError: (err) => {
        toast.error(`Error al confirmar importación: ${err.message}`);
      },
    }),
  );

  const statusMutation = useMutation(
    trpc.container.updateStatus.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(
          `Estado actualizado a ${STATUS_CONFIG[variables.status]?.label ?? variables.status}`,
        );
        void refetch();
        void qc.invalidateQueries({ queryKey: [["container"]] });
      },
      onError: (err) => {
        toast.error(`Error al actualizar estado: ${err.message}`);
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
          setAiProgress("Leyendo archivo Excel en el navegador...");
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
            `${totalRows.toLocaleString()} filas extraídas → ${totalChunks} lotes de ≤2MB`,
          );

          const allItems: ParsedItem[] = [];
          const failedChunks: number[] = [];
          let lastStats: AIStats | null = null;
          let lastPromptSource = "";

          for (let i = 0; i < chunks.length; i++) {
            if (i > 0) {
              const delayMs = 30000;
              const delaySec = delayMs / 1000;
              for (let sec = delaySec; sec > 0; sec--) {
                setAiProgress(
                  `Esperando ${sec}s antes del lote ${i + 1}/${totalChunks} ` +
                    `(${allItems.length} items acumulados)...`,
                );
                await new Promise((r) => setTimeout(r, 1000));
              }
            }

            setAiProgress(
              `Procesando lote ${i + 1} de ${totalChunks} con IA ` +
                `(${allItems.length} items acumulados)...`,
            );

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
                  const retryAfter = parseInt(
                    response.headers.get("retry-after") ?? "15",
                    10,
                  );
                  const waitSec = Math.max(retryAfter, 10) * (attempt + 1);
                  for (let sec = waitSec; sec > 0; sec--) {
                    setAiProgress(
                      `Límite de API alcanzado — reintentando lote ${i + 1} en ${sec}s...`,
                    );
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                  continue;
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
                break;
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

          if (allItems.length === 0 && failedChunks.length > 0) {
            throw new Error(
              `Todos los ${totalChunks} lotes fallaron. Revise la conexión o intente de nuevo.`,
            );
          }

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
            `${allItems.length} items procesados de ${totalRows.toLocaleString()} filas (${totalChunks} lotes)` +
              (failedChunks.length > 0
                ? ` · ${failedChunks.length} lotes con incidencia`
                : "") +
              (lastPromptSource ? ` · Motor: ${lastPromptSource}` : ""),
          );
        } else {
          if (file.size > 4 * 1024 * 1024) {
            throw new Error(
              `PDF demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo para PDF: 4MB. Para archivos más grandes, utilice formato Excel (.xlsx).`,
            );
          }

          setAiProgress(`Subiendo ${file.name}...`);
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
            `${data.itemCount} items procesados de ${data.totalRows} filas · Motor: ${data.promptSource}`,
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

  const dualFob = useMemo(() => {
    if (!container) return { usd: "—", bs: "—" };
    return formatDualCurrency(Number(container.costFob ?? 0), bcv.rate);
  }, [container, bcv.rate]);

  // ── Loading ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState
          icon="Package2"
          title="Contenedor no encontrado"
          description="El registro de importación solicitado no existe o fue removido."
          action={
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <Icons.ArrowBack className="size-3.5" />
              Volver a Contenedores
            </Button>
          }
        />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[container.status] ?? {
    label: container.status,
    tone: "neutral" as StatusTone,
    icon: "Draft" as const,
  };
  const canUpload =
    container.status === "created" || container.status === "in_transit";

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Link
          href="/containers"
          className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <Icons.ArrowBack className="size-3.5" />
          Contenedores
        </Link>
        <Icons.ChevronRight className="size-3" />
        <span className="text-foreground font-mono font-medium">
          #{container.containerNumber}
        </span>
      </div>

      {/* Executive Card Header */}
      <div className="surface-card border-border-subtle rounded-xl border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <Icon name={cfg.icon} className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-foreground font-mono text-2xl font-medium tracking-tight">
                  {container.containerNumber}
                </h1>
                <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Importación registrada el{" "}
                {new Date(container.createdAt).toLocaleDateString("es-VE")}
              </p>
            </div>
          </div>

          {/* Status Transitions Workflow */}
          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <div className="flex flex-wrap items-center gap-2">
              {container.status === "created" && (
                <Button
                  onClick={() =>
                    statusMutation.mutate({ id, status: "in_transit" })
                  }
                  disabled={statusMutation.isPending}
                  className="min-h-11 gap-2"
                >
                  <Icons.DirectionsBoat className="size-4" />
                  Marcar en Tránsito
                </Button>
              )}
              {container.status === "in_transit" && (
                <Button
                  onClick={() =>
                    statusMutation.mutate({ id, status: "received" })
                  }
                  disabled={statusMutation.isPending}
                  className="min-h-11 gap-2 bg-amber-600 text-white hover:bg-amber-500"
                >
                  <Icons.MoveToInbox className="size-4" />
                  Iniciar Recepción
                </Button>
              )}
              {container.status === "received" && (
                <Button
                  onClick={() =>
                    statusMutation.mutate({ id, status: "closed" })
                  }
                  disabled={statusMutation.isPending}
                  className="min-h-11 gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Icons.CheckCircle className="size-4" />
                  Cerrar y Liquidar Carga
                </Button>
              )}
            </div>
          </RoleGuard>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Estado Operativo"
          value={cfg.label}
          icon={cfg.icon}
          tone={cfg.tone === "neutral" ? "default" : cfg.tone}
          sub="Fase actual en la cadena de importación"
        />
        <StatCard
          label="Inversión FOB"
          value={dualFob.usd}
          icon="AttachMoney"
          tone="success"
          sub={`Oficial BCV: ${dualFob.bs}`}
        />
        <StatCard
          label="Fecha de Salida"
          value={
            container.departureDate
              ? new Date(container.departureDate).toLocaleDateString("es-VE")
              : "No definida"
          }
          icon="FlightTakeoff"
          tone="default"
          sub="Zarpe desde puerto de origen"
        />
        <StatCard
          label="Llegada Estimada"
          value={
            container.arrivalDate
              ? new Date(container.arrivalDate).toLocaleDateString("es-VE")
              : "No definida"
          }
          icon="FlightLand"
          tone="primary"
          sub="Arribo a aduana / puerto nacional"
        />
      </div>

      {/* ═══ AI Packing List Section ═══ */}
      <section className="surface-card border-border-subtle overflow-hidden rounded-xl border">
        <div className="border-border-subtle bg-muted/30 flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Icons.SmartToy className="size-5" />
            </div>
            <div>
              <h2 className="text-foreground text-sm font-medium tracking-widest uppercase">
                Packing List Inteligente
              </h2>
              <p className="text-muted-foreground text-xs">
                Extracción automática de productos y costeo asistido por IA
              </p>
            </div>
          </div>
          {container.packingListItemCount > 0 && (
            <StatusBadge tone="success">
              {`${container.packingListItemCount} items registrados`}
            </StatusBadge>
          )}
        </div>

        <div className="space-y-4 p-4 lg:p-6">
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
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border-subtle hover:border-primary/50 hover:bg-muted/40"
              } ${aiStatus === "processing" ? "pointer-events-none opacity-60" : ""}`}
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
                  <div className="bg-primary/10 text-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
                    <Icons.CloudUpload className="size-6" />
                  </div>
                  <p className="text-foreground text-sm font-medium">
                    Arrastra el archivo de Packing List aquí o haz clic para
                    seleccionar
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Soporta Excel (.xlsx / .xls) y PDF con desglose de ítems
                  </p>
                </>
              )}
              {(aiStatus === "uploading" || aiStatus === "processing") && (
                <div className="flex flex-col items-center gap-3">
                  <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
                  <p className="text-primary text-sm font-medium">
                    {aiProgress}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Procesando estructuración con IA... por favor espera un
                    momento
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {aiStatus === "error" && (
            <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-xl border p-4">
              <Icons.Error className="text-destructive size-5" />
              <div className="flex-1">
                <p className="text-destructive text-sm font-medium">
                  Error al procesar el documento
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {aiError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAiStatus("idle");
                    setAiError("");
                  }}
                  className="mt-3 min-h-9 gap-1 text-xs"
                >
                  <Icons.RestartAlt className="size-3.5" />
                  Intentar de nuevo
                </Button>
              </div>
            </div>
          )}

          {/* Success Progress Message */}
          {aiStatus === "done" && aiProgress && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-600 dark:text-emerald-400">
              <Icons.CheckCircle className="size-4.5" />
              <p className="text-xs font-medium">{aiProgress}</p>
            </div>
          )}

          {/* Stats Bar */}
          {aiStats && parsedItems.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                {
                  label: "Coincidentes",
                  value: aiStats.matched,
                  tone: "text-emerald-600 dark:text-emerald-400",
                  icon: "check_circle",
                },
                {
                  label: "Por Revisar",
                  value: aiStats.review,
                  tone: "text-amber-600 dark:text-amber-400",
                  icon: "help",
                },
                {
                  label: "Nuevos Ítems",
                  value: aiStats.newItems,
                  tone: "text-primary",
                  icon: "add_circle",
                },
                {
                  label: "Alta Certeza",
                  value: aiStats.highConfidence,
                  tone: "text-emerald-600 dark:text-emerald-400",
                  icon: "verified",
                },
                {
                  label: "Media Certeza",
                  value: aiStats.mediumConfidence,
                  tone: "text-amber-600 dark:text-amber-400",
                  icon: "balance",
                },
                {
                  label: "Baja Certeza",
                  value: aiStats.lowConfidence,
                  tone: "text-destructive",
                  icon: "warning",
                },
                {
                  label: "Imágenes",
                  value: aiStats.imagesExtracted,
                  tone: "text-foreground",
                  icon: "photo_camera",
                },
                {
                  label: "Analizadas",
                  value: aiStats.imagesAnalyzed,
                  tone: "text-foreground",
                  icon: "analytics",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="surface-card border-border-subtle rounded-lg border p-2.5 text-center"
                >
                  <p
                    className={`font-mono text-base font-medium tabular-nums ${s.tone}`}
                  >
                    {s.value}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px] font-medium tracking-wider uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Parsed Items Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                    Ítems Extraídos ({parsedItems.length})
                  </h3>
                  <p className="text-muted-foreground text-[11px]">
                    Verifica la traducción y los costos antes de consolidar el
                    inventario
                  </p>
                </div>
                <Button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className="bg-primary text-primary-foreground min-h-11 gap-2"
                >
                  {confirmMutation.isPending ? (
                    <div className="border-primary-foreground size-4 animate-spin rounded-full border-2 border-t-transparent" />
                  ) : (
                    <Icons.Database className="size-4" />
                  )}
                  Confirmar e Importar al Sistema
                </Button>
              </div>

              {/* Table */}
              <div className="surface-card border-border-subtle overflow-hidden rounded-xl border">
                <div className="max-h-120 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow className="border-border-subtle">
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="w-12 text-center">Foto</TableHead>
                        <TableHead className="w-20 text-center">
                          Certeza
                        </TableHead>
                        <TableHead>Nombre Original</TableHead>
                        <TableHead>Traducción Comercial</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">
                          Costo Unit.
                        </TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Afinidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedItems.map((item, i) => {
                        const confidenceTone: StatusTone =
                          item.confidence >= 0.8 || item.confidence >= 80
                            ? "success"
                            : item.confidence >= 0.5 || item.confidence >= 50
                              ? "warning"
                              : "destructive";

                        return (
                          <TableRow
                            key={i}
                            className="border-border-subtle hover:bg-accent/40"
                          >
                            <TableCell className="text-muted-foreground text-center font-mono text-xs tabular-nums">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.image_url ? (
                                <button
                                  type="button"
                                  onClick={() => setZoomImage(item.image_url)}
                                  className="group border-border-subtle hover:ring-primary/40 relative inline-block size-9 overflow-hidden rounded-md border transition-all hover:ring-2"
                                  title={item.image_description ?? "Ver imagen"}
                                >
                                  <Image
                                    src={item.image_url}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="size-full object-cover"
                                    unoptimized
                                  />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge tone={confidenceTone}>
                                {`${Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)}%`}
                              </StatusBadge>
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground max-w-44 truncate text-xs"
                              title={item.original_name}
                            >
                              {item.original_name}
                            </TableCell>
                            <TableCell className="max-w-52">
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
                                  className="border-primary bg-background focus:ring-primary w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-1"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(i)}
                                  className="text-foreground hover:text-primary w-full truncate text-left text-xs font-medium transition-colors"
                                  title="Haz clic para editar la traducción"
                                >
                                  {item.name_es}
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                              {item.unit_cost != null
                                ? `$${item.unit_cost.toFixed(2)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.sku_hint ? (
                                <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-medium">
                                  {item.sku_hint}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {item.category_hint ?? "—"}
                            </TableCell>
                            <TableCell>
                              {item.match_type === "exact_sku" && (
                                <StatusBadge tone="success">
                                  SKU Exacto
                                </StatusBadge>
                              )}
                              {item.match_type === "name_similarity" && (
                                <StatusBadge tone="primary">
                                  {`~${item.match_confidence}%`}
                                </StatusBadge>
                              )}
                              {(item.match_type === "no_match" ||
                                item.match_type === "ai_only") && (
                                <StatusBadge tone="neutral">Nuevo</StatusBadge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Image Zoom Modal */}
          {zoomImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setZoomImage(null)}
            >
              <div
                className="bg-card border-border-subtle relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl border shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setZoomImage(null)}
                  className="bg-background/80 text-foreground hover:bg-background absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all"
                  title="Cerrar vista previa"
                >
                  <Icons.Close className="size-4.5" />
                </button>
                <Image
                  src={zoomImage}
                  alt="Vista previa de producto"
                  width={800}
                  height={600}
                  className="max-h-[80vh] max-w-[85vw] object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Container Details Section */}
      <section className="surface-card border-border-subtle rounded-xl border p-6">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Ficha Técnica del Contenedor
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Número de Contenedor", value: container.containerNumber },
            { label: "Estado Actual", value: cfg.label },
            {
              label: "Costo FOB Total",
              value: `${dualFob.usd} (${dualFob.bs})`,
            },
            {
              label: "Fecha de Salida",
              value: container.departureDate
                ? new Date(container.departureDate).toLocaleDateString("es-VE")
                : "No definida",
            },
            {
              label: "Fecha de Llegada",
              value: container.arrivalDate
                ? new Date(container.arrivalDate).toLocaleDateString("es-VE")
                : "No definida",
            },
            {
              label: "Notas de la Operación",
              value: container.notes ?? "Sin observaciones adicionales",
            },
          ].map((d) => (
            <div
              key={d.label}
              className="border-border-subtle/80 bg-muted/20 rounded-lg border p-3.5"
            >
              <span className="text-muted-foreground block text-[11px] font-medium tracking-wider uppercase">
                {d.label}
              </span>
              <span className="text-foreground mt-1 block font-mono text-sm font-medium">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
