"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useVesRates } from "~/hooks/use-bcv-rate";
import { useCnyRate } from "~/hooks/use-cny-rate";
import { maybeSyncVesRates } from "~/lib/sync-bcv-rate";
import { maybeSyncCnyRate } from "~/lib/sync-cny-rate";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const RATE_META: Record<
  string,
  {
    label: string;
    unit: string;
    icon: string;
    isMaterial?: boolean;
    color: string;
  }
> = {
  bcv: {
    label: "Tasa BCV",
    unit: "Bs/USD",
    icon: "🏛️",
    color: "border-blue-500/40",
  },
  parallel: {
    label: "Paralelo (USDT)",
    unit: "Bs/USDT",
    icon: "💱",
    color: "border-amber-500/40",
  },
  rmb_usd: {
    label: "RMB → USD",
    unit: "RMB/USD",
    icon: "currency_yuan",
    isMaterial: true,
    color: "border-red-500/40",
  },
  rmb_bs: {
    label: "RMB → Bs",
    unit: "Bs/RMB",
    icon: "sync_alt",
    isMaterial: true,
    color: "border-emerald-500/40",
  },
};

export default function RatesPage() {
  const trpc = useTRPC();
  const { data: latestRates, isLoading: ratesLoading } = useQuery(
    trpc.pricing.latestRates.queryOptions(),
  );
  const { data: rateHistory, isLoading: historyLoading } = useQuery(
    trpc.pricing.rateHistory.queryOptions({ limit: 50 }),
  );

  const [convertAmount, setConvertAmount] = useState("100");
  const [convertFrom, setConvertFrom] = useState("usd");
  const [convertTo, setConvertTo] = useState("bs");
  const [convertRateType, setConvertRateType] = useState<
    "oficial" | "paralelo"
  >("oficial");

  // Build rate lookup from live data
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
  const syncRate = useMutation(trpc.pricing.setRate.mutationOptions());
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

  // Build rate cards from live data with delta calculation
  const rateCards = useMemo(() => {
    const cards = (latestRates ?? []).map((r) => {
      const meta = RATE_META[r.rateType] ?? {
        label: r.rateType,
        unit: "",
        icon: "🔄",
        color: "border-border",
      };
      // Find previous rate in history for delta
      const historyForType = (rateHistory ?? []).filter(
        (h) => h.rateType === r.rateType,
      );
      const prev = historyForType[1];
      const prevRate = prev?.rate ?? r.rate;
      // Override with live rates
      const isBcvLive = r.rateType === "bcv" && ves.oficial.rate > 0;
      const isParaleloLive = r.rateType === "parallel" && ves.paralelo.rate > 0;
      const isRmbLive = r.rateType === "rmb_usd" && cny.rate > 0;
      const isLive = isBcvLive || isParaleloLive || isRmbLive;
      return {
        ...meta,
        type: r.rateType,
        value: isBcvLive
          ? ves.oficial.rate
          : isParaleloLive
            ? ves.paralelo.rate
            : isRmbLive
              ? cny.rate
              : r.rate,
        prev: prevRate,
        source: isBcvLive
          ? `DolarAPI Oficial (${ves.oficial.date})`
          : isParaleloLive
            ? `DolarAPI Paralelo (${ves.paralelo.date})`
            : isRmbLive
              ? `Frankfurter (${cny.date})`
              : (r.source ?? "—"),
        isLive,
      };
    });
    return cards;
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

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Tasas de Cambio
        </h1>
        <p className="text-muted-foreground text-sm">
          Panel centralizado de tasas — Fuente: DolarAPI.com
        </p>
      </div>

      {/* Rate Cards */}
      {ratesLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rateCards.map((rate) => {
            const delta =
              rate.prev !== 0
                ? ((rate.value - rate.prev) / rate.prev) * 100
                : 0;
            const isUp = delta > 0;
            return (
              <div
                key={rate.type}
                className={`rounded-xl border-l-4 ${rate.color} bg-card border-border border p-4`}
              >
                <div className="flex items-center gap-2">
                  {rate.isMaterial ? (
                    <span className="material-symbols-outlined text-lg">
                      {rate.icon}
                    </span>
                  ) : (
                    <span className="text-xl">{rate.icon}</span>
                  )}
                  <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    {rate.label}
                  </span>
                </div>
                <p className="text-foreground mt-2 text-3xl font-bold">
                  {rate.value.toFixed(2)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {rate.unit}
                  </span>
                  {delta !== 0 && (
                    <span
                      className={`text-xs font-medium ${isUp ? "text-red-400" : "text-emerald-400"}`}
                    >
                      {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}%
                    </span>
                  )}
                  {rate.isLive && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      En vivo
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Spread Card */}
      {ves.oficial.rate > 0 && ves.paralelo.rate > 0 && (
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            Brecha Cambiaria (Spread)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Oficial (BCV)
              </p>
              <p className="text-foreground mt-1 text-2xl font-bold">
                {ves.oficial.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">Bs/USD</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Paralelo (USDT)
              </p>
              <p className="text-foreground mt-1 text-2xl font-bold">
                {ves.paralelo.rate.toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">Bs/USDT</p>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Spread
              </p>
              <p className="text-foreground mt-1 text-2xl font-bold">
                {ves.spread.percentage.toFixed(2)}%
              </p>
              <p className="text-muted-foreground text-xs">
                +Bs {ves.spread.absolute.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calculator */}
      <div className="border-border bg-card rounded-xl border p-5">
        <h2 className="text-muted-foreground mb-4 text-sm font-medium">
          Calculadora de Conversión
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label className="text-muted-foreground mb-1 block text-xs">
              Monto
            </label>
            <input
              type="number"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="border-border bg-card text-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              De
            </label>
            <select
              value={convertFrom}
              onChange={(e) => setConvertFrom(e.target.value)}
              className="border-border bg-card text-foreground rounded-lg border px-3 py-2.5 text-sm outline-none"
            >
              <option value="usd">USD $</option>
              <option value="bs">Bs</option>
              <option value="rmb">RMB ¥</option>
            </select>
          </div>
          <span className="text-muted-foreground pb-2 text-lg">→</span>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              A
            </label>
            <select
              value={convertTo}
              onChange={(e) => setConvertTo(e.target.value)}
              className="border-border bg-card text-foreground rounded-lg border px-3 py-2.5 text-sm outline-none"
            >
              <option value="bs">Bs</option>
              <option value="usd">USD $</option>
              <option value="rmb">RMB ¥</option>
            </select>
          </div>
          {/* Rate type selector — visible when converting to/from Bs */}
          {(convertFrom === "bs" || convertTo === "bs") && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Tasa
              </label>
              <select
                value={convertRateType}
                onChange={(e) =>
                  setConvertRateType(e.target.value as "oficial" | "paralelo")
                }
                className="border-border bg-card text-foreground rounded-lg border px-3 py-2.5 text-sm outline-none"
              >
                <option value="oficial">Oficial (BCV)</option>
                <option value="paralelo">Paralelo (USDT)</option>
              </select>
            </div>
          )}
          <div className="flex-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5">
            <p className="text-primary/70 text-xs">
              Resultado
              {(convertFrom === "bs" || convertTo === "bs") && (
                <span className="text-muted-foreground ml-1">
                  ({convertRateType === "paralelo" ? "Paralelo" : "BCV"}:{" "}
                  {activeBsRate.toFixed(2)})
                </span>
              )}
            </p>
            <p className="text-primary text-xl font-bold">
              {computeConversion().toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Rate History */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          Historial de Tasas
        </h2>
        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Fecha/Hora</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Tasa</th>
                  <th className="px-4 py-3 font-medium">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {(rateHistory ?? []).map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-border hover:bg-accent/50 border-b transition-colors"
                  >
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                          entry.rateType === "bcv"
                            ? "bg-blue-500/10 text-blue-400"
                            : entry.rateType === "parallel"
                              ? "bg-amber-500/10 text-amber-400"
                              : entry.rateType === "rmb_usd"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {entry.rateType === "bcv"
                          ? "BCV"
                          : entry.rateType === "parallel"
                            ? "Paralelo"
                            : entry.rateType.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                      {entry.rate.toFixed(2)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {entry.source ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
