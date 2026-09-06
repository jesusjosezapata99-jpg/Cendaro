"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatusBadge } from "~/components/status-badge";
import { useVesRates } from "~/hooks/use-bcv-rate";
import { useCnyRate } from "~/hooks/use-cny-rate";
import { maybeSyncVesRates } from "~/lib/sync-bcv-rate";
import { maybeSyncCnyRate } from "~/lib/sync-cny-rate";
import { useTRPC } from "~/trpc/client";

interface RateMeta {
  label: string;
  unit: string;
  icon: string;
  tone: StatusTone;
}

const RATE_META: Record<string, RateMeta> = {
  bcv: {
    label: "Tasa Oficial (BCV)",
    unit: "Bs/USD",
    icon: "account_balance",
    tone: "primary",
  },
  parallel: {
    label: "Paralelo (USDT)",
    unit: "Bs/USDT",
    icon: "currency_exchange",
    tone: "warning",
  },
  rmb_usd: {
    label: "RMB → USD",
    unit: "RMB/USD",
    icon: "currency_yuan",
    tone: "destructive",
  },
  rmb_bs: {
    label: "RMB → Bs",
    unit: "Bs/RMB",
    icon: "sync_alt",
    tone: "success",
  },
};

const cellPx = "px-4 py-3";

export default function RatesClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: latestRates, isLoading: ratesLoading } = useQuery(
    trpc.pricing.latestRates.queryOptions(),
  );
  const { data: rateHistory, isLoading: historyLoading } = useQuery(
    trpc.pricing.rateHistory.queryOptions({ limit: 100 }),
  );

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

  /* Auto-sync both VES rates + CNY to ExchangeRate table */
  const syncRate = useMutation(
    trpc.pricing.setRate.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["pricing"]] });
      },
    }),
  );
  const syncRateRef = useRef(syncRate);
  syncRateRef.current = syncRate;

  useEffect(() => {
    void maybeSyncVesRates({
      latestRates: latestRates,
      setRate: (input) => syncRateRef.current.mutateAsync(input),
    });
    void maybeSyncCnyRate({
      latestRates: latestRates,
      setRate: (input) => syncRateRef.current.mutateAsync(input),
    });
  }, [latestRates]);

  const handleManualRefresh = () => {
    void maybeSyncVesRates({
      latestRates: latestRates,
      setRate: (input) => syncRateRef.current.mutateAsync(input),
    });
    void maybeSyncCnyRate({
      latestRates: latestRates,
      setRate: (input) => syncRateRef.current.mutateAsync(input),
    });
    void qc.invalidateQueries({ queryKey: [["pricing"]] });
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
        icon: "currency_exchange",
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

  const filteredHistory = useMemo(() => {
    const list = rateHistory ?? [];
    if (rateFilter === "all") return list;
    return list.filter((h) => h.rateType === rateFilter);
  }, [rateHistory, rateFilter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Tasas de Cambio"
        description="Panel centralizado de divisas, sincronización automática y brecha cambiaria"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <Button
              onClick={handleManualRefresh}
              className="min-h-11 flex-1 sm:flex-initial"
              disabled={syncRate.isPending}
            >
              <span className="material-symbols-outlined text-lg">sync</span>
              {syncRate.isPending ? "Sincronizando..." : "Actualizar Tasas"}
            </Button>
          </RoleGuard>
        }
      />

      {/* 4 Currency Rate Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ratesLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-8 w-36" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))
          : rateCards.map((rate) => {
              const isUp = rate.delta > 0;
              return (
                <div
                  key={rate.type}
                  className="border-border-subtle surface-card rounded-xl border p-4 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-muted-foreground text-lg">
                        {rate.icon}
                      </span>
                      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        {rate.label}
                      </span>
                    </div>
                    {rate.isLive && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                        En vivo
                      </span>
                    )}
                  </div>

                  <p className="text-foreground mt-3 font-mono text-3xl font-bold tabular-nums">
                    {rate.value.toFixed(2)}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {rate.unit}
                    </span>

                    {rate.delta !== 0 && (
                      <div
                        className={`flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums ${
                          isUp ? "text-destructive" : "text-emerald-500"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isUp ? "trending_up" : "trending_down"}
                        </span>
                        <span>{Math.abs(rate.delta).toFixed(2)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="border-border-subtle text-muted-foreground mt-3 truncate border-t pt-2 text-[10px]">
                    {rate.source}
                  </div>
                </div>
              );
            })}
      </div>

      {/* Brecha Cambiaria (Spread Card) */}
      {ves.oficial.rate > 0 && ves.paralelo.rate > 0 && (
        <div className="border-border-subtle surface-card rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-base">
                currency_exchange
              </span>
              <h2 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                Brecha Cambiaria Oficial vs Paralelo
              </h2>
            </div>
            <StatusBadge
              tone={
                ves.spread.percentage > 15
                  ? "destructive"
                  : ves.spread.percentage > 5
                    ? "warning"
                    : "success"
              }
            >
              Spread: {ves.spread.percentage.toFixed(2)}%
            </StatusBadge>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-border-subtle bg-card/60 rounded-lg border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Oficial (BCV)
              </p>
              <p className="text-primary mt-1 font-mono text-2xl font-bold tabular-nums">
                {ves.oficial.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                Bs/USD
              </p>
            </div>

            <div className="border-border-subtle bg-card/60 rounded-lg border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Paralelo (USDT)
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-500 tabular-nums">
                {ves.paralelo.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                Bs/USDT
              </p>
            </div>

            <div className="border-border-subtle bg-card/60 rounded-lg border p-3.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Diferencial Neto
              </p>
              <p className="text-foreground mt-1 font-mono text-2xl font-bold tabular-nums">
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
      <div className="border-border-subtle surface-card rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-muted-foreground text-base">
            currency_exchange
          </span>
          <h2 className="text-foreground text-xs font-semibold tracking-wider uppercase">
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
              className="border-border-subtle bg-card text-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-base tabular-nums outline-none focus:ring-2"
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
              className="border-border-subtle bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
              className="border-border-subtle hover:bg-accent text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-lg border transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                swap_horiz
              </span>
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
              className="border-border-subtle bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
                className="border-border-subtle bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
            className={`border-border-subtle bg-primary/5 rounded-lg border p-3 ${
              convertFrom === "bs" || convertTo === "bs"
                ? "lg:col-span-2"
                : "lg:col-span-4"
            }`}
          >
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Resultado Estimado
            </p>
            <p className="text-primary mt-0.5 font-mono text-xl font-bold tabular-nums">
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
            <span className="material-symbols-outlined text-muted-foreground text-base">
              schedule
            </span>
            <h2 className="text-foreground text-xs font-semibold tracking-wider uppercase">
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
                className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  rateFilter === f.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mobile: Card View ─────────────────────── */}
        <div className="space-y-2 md:hidden">
          {historyLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border-subtle surface-card rounded-xl border p-3"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-6 w-20" />
                </div>
              ))
            : filteredHistory.map((entry) => {
                const meta = RATE_META[entry.rateType] ?? {
                  label: entry.rateType,
                  unit: "",
                  icon: "currency_exchange",
                  tone: "neutral" as StatusTone,
                };
                return (
                  <div
                    key={entry.id}
                    className="border-border-subtle surface-card rounded-xl border p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-muted-foreground text-base">
                          {meta.icon}
                        </span>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </div>
                      <span className="text-foreground font-mono text-base font-bold tabular-nums">
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
              })}

          {!historyLoading && filteredHistory.length === 0 && (
            <EmptyState
              icon="schedule"
              title="Sin registros históricos"
              description="No hay cotizaciones para el tipo de tasa seleccionado."
            />
          )}
        </div>

        {/* ── Desktop: Table View ───────────────────── */}
        <div className="border-border-subtle surface-card hidden gap-0 overflow-hidden rounded-xl border py-0 md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border-subtle border-b">
                <th
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Fecha y Hora
                </th>
                <th
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Tipo de Tasa
                </th>
                <th
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Cotización
                </th>
                <th
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Fuente Registrada
                </th>
              </tr>
            </thead>
            <tbody>
              {historyLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-border-subtle border-b">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className={cellPx}>
                          <Skeleton className="h-5 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filteredHistory.map((entry) => {
                    const meta = RATE_META[entry.rateType] ?? {
                      label: entry.rateType,
                      unit: "",
                      icon: "currency_exchange",
                      tone: "neutral" as StatusTone,
                    };
                    return (
                      <tr
                        key={entry.id}
                        className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                      >
                        <td
                          className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                        >
                          {new Date(entry.createdAt).toLocaleString("es-VE")}
                        </td>
                        <td className={cellPx}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              {meta.icon}
                            </span>
                            <StatusBadge tone={meta.tone}>
                              {meta.label}
                            </StatusBadge>
                          </div>
                        </td>
                        <td
                          className={`text-foreground ${cellPx} text-right font-mono text-sm font-bold tabular-nums`}
                        >
                          {entry.rate.toFixed(2)}
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} text-xs`}
                        >
                          {entry.source ?? "—"}
                        </td>
                      </tr>
                    );
                  })}

              {!historyLoading && filteredHistory.length === 0 && (
                <tr className="hover:bg-transparent">
                  <td colSpan={4} className="px-4 py-6">
                    <EmptyState
                      icon="schedule"
                      title="Sin registros históricos"
                      description="No hay cotizaciones para el tipo de tasa seleccionado."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
