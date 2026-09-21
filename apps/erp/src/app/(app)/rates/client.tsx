"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Can } from "~/components/role-guard";
import { useVesRates } from "~/hooks/use-bcv-rate";
import { useCnyRate } from "~/hooks/use-cny-rate";
import { useSyncRates } from "~/hooks/use-sync-rates";
import { useTRPC } from "~/trpc/client";
import { HeldRatesPanel } from "./held-rates-panel";

interface RateMeta {
  label: string;
  unit: string;
  icon: IconName;
  tone: StatusTone;
}

const RATE_META: Record<string, RateMeta> = {
  bcv: {
    label: "Tasa Oficial (BCV)",
    unit: "Bs/USD",
    icon: "AccountBalance",
    tone: "default",
  },
  parallel: {
    label: "Paralelo (USDT)",
    unit: "Bs/USDT",
    icon: "CurrencyExchange",
    tone: "warning",
  },
  rmb_usd: {
    label: "RMB → USD",
    unit: "RMB/USD",
    icon: "CurrencyYuan",
    tone: "destructive",
  },
  rmb_bs: {
    label: "RMB → Bs",
    unit: "Bs/RMB",
    icon: "SyncAlt",
    tone: "success",
  },
};

interface RateHistoryItem {
  id: string;
  rateType: string;
  rate: number;
  source: string | null;
  createdAt: Date | string;
}

export default function RatesClient() {
  const trpc = useTRPC();

  const { data: latestRates, isLoading: ratesLoading } = useQuery(
    trpc.pricing.latestRates.queryOptions(),
  );
  const {
    data: rateHistory,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery(trpc.pricing.rateHistory.queryOptions({ limit: 100 }));

  const [rateFilter, setRateFilter] = useState<string>("all");
  const [convertAmount, setConvertAmount] = useState("100");
  const [convertFrom, setConvertFrom] = useState<"usd" | "bs" | "rmb">("usd");
  const [convertTo, setConvertTo] = useState<"usd" | "bs" | "rmb">("bs");
  const [convertRateType, setConvertRateType] = useState<
    "oficial" | "paralelo"
  >("oficial");

  // Build rate lookup from DB
  const ratesByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of latestRates ?? []) {
      map.set(r.rateType, r.rate);
    }
    return map;
  }, [latestRates]);

  /* VES Live Rates (Official + Parallel) */
  const ves = useVesRates();
  const liveBcv =
    ves.oficial.rate > 0 ? ves.oficial.rate : (ratesByType.get("bcv") ?? 1);
  const liveParalelo =
    ves.paralelo.rate > 0
      ? ves.paralelo.rate
      : (ratesByType.get("parallel") ?? 1);

  /* CNY/RMB Live Rate */
  const cny = useCnyRate();
  const liveRmb = cny.rate > 0 ? cny.rate : (ratesByType.get("rmb_usd") ?? 1);

  /* Active Bs rate for calculator */
  const activeBsRate = convertRateType === "paralelo" ? liveParalelo : liveBcv;

  /* Stored rates: the server fetches and stores them (pricing.syncRates) */
  const rateSync = useSyncRates({ auto: true });

  const handleManualRefresh = () => {
    rateSync.sync(true).then(
      (result) => {
        const held = result.results.filter(
          (r) => r.status === "held" || r.status === "rejected",
        ).length;
        if (held > 0) {
          toast.warning(
            `${held} ${held === 1 ? "tasa retenida" : "tasas retenidas"} por una variación inusual`,
          );
        } else {
          toast.success("Tasas actualizadas");
        }
      },
      (error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron actualizar las tasas",
        ),
    );
  };

  const handleSwapCurrencies = () => {
    const temp = convertFrom;
    setConvertFrom(convertTo);
    setConvertTo(temp);
  };

  const computeConversion = () => {
    const amt = parseFloat(convertAmount) || 0;
    if (convertFrom === "usd" && convertTo === "bs") return amt * activeBsRate;
    if (convertFrom === "bs" && convertTo === "usd") return amt / activeBsRate;
    if (convertFrom === "rmb" && convertTo === "usd") return amt / liveRmb;
    if (convertFrom === "usd" && convertTo === "rmb") return amt * liveRmb;
    if (convertFrom === "rmb" && convertTo === "bs")
      return (amt / liveRmb) * activeBsRate;
    if (convertFrom === "bs" && convertTo === "rmb")
      return (amt / activeBsRate) * liveRmb;
    return amt;
  };

  // Build rate cards with delta calculation
  const rateCards = useMemo(() => {
    return (latestRates ?? []).map((r) => {
      const meta = RATE_META[r.rateType] ?? {
        label: r.rateType,
        unit: "",
        icon: "CurrencyExchange" as const,
        tone: "neutral" as StatusTone,
      };

      const historyForType = (rateHistory ?? []).filter(
        (h) => h.rateType === r.rateType,
      );
      const prev = historyForType[1];
      const prevRate = prev?.rate ?? r.rate;

      const isBcvLive = r.rateType === "bcv" && ves.oficial.rate > 0;
      const isParaleloLive = r.rateType === "parallel" && ves.paralelo.rate > 0;
      const isRmbLive = r.rateType === "rmb_usd" && cny.rate > 0;
      const isLive = isBcvLive || isParaleloLive || isRmbLive;

      const currentValue = isBcvLive
        ? ves.oficial.rate
        : isParaleloLive
          ? ves.paralelo.rate
          : isRmbLive
            ? cny.rate
            : r.rate;

      const delta =
        prevRate !== 0 ? ((currentValue - prevRate) / prevRate) * 100 : 0;

      const sourceText = isBcvLive
        ? `DolarAPI Oficial (${ves.oficial.date || "Hoy"})`
        : isParaleloLive
          ? `DolarAPI Paralelo (${ves.paralelo.date || "Hoy"})`
          : isRmbLive
            ? `Frankfurter (${cny.date || "Hoy"})`
            : (r.source ?? "Sistema");

      return {
        ...meta,
        type: r.rateType,
        value: currentValue,
        prev: prevRate,
        delta,
        source: sourceText,
        isLive,
      };
    });
  }, [
    latestRates,
    rateHistory,
    ves.oficial.rate,
    ves.oficial.date,
    ves.paralelo.rate,
    ves.paralelo.date,
    cny.rate,
    cny.date,
  ]);

  const rawHistory = useMemo(
    () => (rateHistory ?? []) as unknown as RateHistoryItem[],
    [rateHistory],
  );

  const filteredHistory = useMemo(() => {
    if (rateFilter === "all") return rawHistory;
    return rawHistory.filter((h) => h.rateType === rateFilter);
  }, [rawHistory, rateFilter]);

  const columns = useMemo<ColumnDef<RateHistoryItem>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha y Hora",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "rateType",
        header: "Tipo de Tasa",
        cell: ({ row }) => {
          const meta = RATE_META[row.original.rateType] ?? {
            label: row.original.rateType,
            unit: "",
            icon: "CurrencyExchange" as const,
            tone: "neutral" as StatusTone,
          };
          return (
            <div className="flex items-center gap-2">
              <Icon
                name={meta.icon}
                className="text-muted-foreground size-4 shrink-0"
              />
              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "rate",
        header: () => <div className="text-right">Cotización</div>,
        cell: ({ row }) => (
          <div className="text-foreground text-right font-mono text-sm font-medium tabular-nums">
            {row.original.rate.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "source",
        header: "Fuente Registrada",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.source ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Tasas de Cambio"
        description="Panel centralizado de divisas, sincronización automática y brecha cambiaria"
        actions={
          <Can module="rates" action="update">
            <Button
              onClick={handleManualRefresh}
              className="min-h-11 flex-1 sm:flex-initial"
              disabled={rateSync.isSyncing}
            >
              <Icons.Sync className="size-4.5" />
              {rateSync.isSyncing ? "Sincronizando..." : "Actualizar Tasas"}
            </Button>
          </Can>
        }
      />

      <HeldRatesPanel />

      {/* 4 Currency Rate Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ratesLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card animate-pulse border p-4"
              >
                <div className="bg-muted h-4 w-28" />
                <div className="bg-muted mt-3 h-8 w-36" />
                <div className="bg-muted mt-2 h-3 w-20" />
              </div>
            ))
          : rateCards.map((rate) => {
              const isUp = rate.delta > 0;
              return (
                <div
                  key={rate.type}
                  className="border-border bg-card hover:border-foreground/20 border p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={rate.icon}
                        className="text-muted-foreground size-4.5"
                      />
                      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        {rate.label}
                      </span>
                    </div>
                    {rate.isLive && (
                      <StatusPill tone="success">En vivo</StatusPill>
                    )}
                  </div>

                  <p className="text-foreground mt-3 font-mono text-3xl font-medium tabular-nums">
                    {rate.value.toFixed(2)}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {rate.unit}
                    </span>

                    {rate.delta !== 0 && (
                      <div
                        className={`flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums ${
                          isUp ? "text-destructive" : "text-emerald-500"
                        }`}
                      >
                        {isUp ? (
                          <Icons.TrendingUp className="size-3.5" />
                        ) : (
                          <Icons.TrendingDown className="size-3.5" />
                        )}
                        <span>{Math.abs(rate.delta).toFixed(2)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="border-border text-muted-foreground mt-3 truncate border-t pt-2 text-[10px]">
                    {rate.source}
                  </div>
                </div>
              );
            })}
      </div>

      {/* Brecha Cambiaria (Spread Card) */}
      {ves.oficial.rate > 0 && ves.paralelo.rate > 0 && (
        <div className="border-border bg-card border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.CurrencyExchange className="text-muted-foreground size-4" />
              <h2 className="text-foreground text-xs font-medium tracking-wider uppercase">
                Brecha Cambiaria Oficial vs Paralelo
              </h2>
            </div>
            <StatusPill
              tone={
                ves.spread.percentage > 15
                  ? "destructive"
                  : ves.spread.percentage > 5
                    ? "warning"
                    : "success"
              }
            >
              Spread: {ves.spread.percentage.toFixed(2)}%
            </StatusPill>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-border bg-card/60 border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Oficial (BCV)
              </p>
              <p className="text-primary mt-1 font-mono text-2xl font-medium tabular-nums">
                {ves.oficial.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                Bs/USD
              </p>
            </div>

            <div className="border-border bg-card/60 border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Paralelo (USDT)
              </p>
              <p className="mt-1 font-mono text-2xl font-medium text-amber-500 tabular-nums">
                {ves.paralelo.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                Bs/USDT
              </p>
            </div>

            <div className="border-border bg-card/60 border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Diferencial Neto
              </p>
              <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
                +Bs {ves.spread.absolute.toFixed(2)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                por cada dólar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Multi-currency Calculator */}
      <div className="border-border bg-card border p-5">
        <div className="flex items-center gap-2">
          <Icons.CurrencyExchange className="text-muted-foreground size-4" />
          <h2 className="text-foreground text-xs font-medium tracking-wider uppercase">
            Calculadora de Conversión Multi-Moneda
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Monto a Convertir
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 font-mono text-base tabular-nums transition-colors outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              De
            </label>
            <select
              value={convertFrom}
              onChange={(e) =>
                setConvertFrom(e.target.value as "usd" | "bs" | "rmb")
              }
              className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-sm transition-colors outline-none"
            >
              <option value="usd">USD ($)</option>
              <option value="bs">Bolívares (Bs)</option>
              <option value="rmb">RMB (¥)</option>
            </select>
          </div>

          <div className="flex items-center justify-center pb-1 lg:col-span-1">
            <button
              type="button"
              onClick={handleSwapCurrencies}
              aria-label="Invertir monedas"
              className="border-border hover:border-foreground hover:bg-accent text-muted-foreground hover:text-foreground flex size-9 items-center justify-center border transition-colors"
            >
              <Icons.SwapHoriz className="size-4.5" />
            </button>
          </div>

          <div className="lg:col-span-2">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              A
            </label>
            <select
              value={convertTo}
              onChange={(e) =>
                setConvertTo(e.target.value as "usd" | "bs" | "rmb")
              }
              className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-sm transition-colors outline-none"
            >
              <option value="bs">Bolívares (Bs)</option>
              <option value="usd">USD ($)</option>
              <option value="rmb">RMB (¥)</option>
            </select>
          </div>

          {(convertFrom === "bs" || convertTo === "bs") && (
            <div className="lg:col-span-2">
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Tasa Utilizada
              </label>
              <select
                value={convertRateType}
                onChange={(e) =>
                  setConvertRateType(e.target.value as "oficial" | "paralelo")
                }
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-sm transition-colors outline-none"
              >
                <option value="oficial">
                  Oficial BCV ({liveBcv.toFixed(2)})
                </option>
                <option value="paralelo">
                  Paralelo USDT ({liveParalelo.toFixed(2)})
                </option>
              </select>
            </div>
          )}

          <div
            className={`border-border bg-primary/5 border p-3 ${
              convertFrom === "bs" || convertTo === "bs"
                ? "lg:col-span-2"
                : "lg:col-span-4"
            }`}
          >
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Resultado Estimado
            </p>
            <p className="text-primary mt-0.5 font-mono text-xl font-medium tabular-nums">
              {computeConversion().toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Rate History Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icons.Schedule className="text-muted-foreground size-4" />
            <h2 className="text-foreground text-xs font-medium tracking-wider uppercase">
              Historial de Cotizaciones
            </h2>
          </div>

          {/* Filter Chips */}
          <div className="mobile-scroll-x flex gap-1.5">
            {[
              { id: "all", label: "Todas" },
              { id: "bcv", label: "BCV" },
              { id: "parallel", label: "Paralelo" },
              { id: "rmb_usd", label: "RMB/USD" },
              { id: "rmb_bs", label: "RMB/Bs" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRateFilter(f.id)}
                className={`h-8 shrink-0 border px-2.5 text-xs font-medium transition-colors ${
                  rateFilter === f.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mobile: Card View ─────────────────────── */}
        <div className="space-y-2 md:hidden">
          {historyLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card animate-pulse border p-3"
              >
                <div className="bg-muted h-4 w-28" />
                <div className="bg-muted mt-2 h-6 w-20" />
              </div>
            ))
          ) : filteredHistory.length === 0 ? (
            <div className="border-border bg-card border p-8">
              <EmptyState
                icon="Schedule"
                title="Sin registros históricos"
                description="No hay cotizaciones para el tipo de tasa seleccionado."
              />
            </div>
          ) : (
            filteredHistory.map((entry) => {
              const meta = RATE_META[entry.rateType] ?? {
                label: entry.rateType,
                unit: "",
                icon: "CurrencyExchange" as const,
                tone: "neutral" as StatusTone,
              };
              return (
                <div
                  key={entry.id}
                  className="border-border bg-card border p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={meta.icon}
                        className="text-muted-foreground size-4"
                      />
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </div>
                    <span className="text-foreground font-mono text-base font-medium tabular-nums">
                      {entry.rate.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                    <span className="font-mono tabular-nums">
                      {new Date(entry.createdAt).toLocaleString("es-VE")}
                    </span>
                    <span className="max-w-37.5 truncate">
                      {entry.source ?? "—"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop: Table View ───────────────────── */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={filteredHistory}
            isLoading={historyLoading}
            isError={historyError}
            onRetry={() => void refetchHistory()}
            onResetFilters={
              rateFilter !== "all" ? () => setRateFilter("all") : undefined
            }
            emptyTitle="Sin registros históricos"
            emptyDescription="No hay cotizaciones para el tipo de tasa seleccionado."
          />
        </div>
      </div>
    </div>
  );
}
