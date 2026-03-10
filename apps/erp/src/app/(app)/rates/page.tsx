"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const RATE_META: Record<
  string,
  { label: string; unit: string; icon: string; color: string }
> = {
  bcv: {
    label: "Tasa BCV",
    unit: "Bs/USD",
    icon: "🏛️",
    color: "border-blue-500/40",
  },
  parallel: {
    label: "Tasa Paralela",
    unit: "Bs/USD",
    icon: "bar_chart",
    color: "border-amber-500/40",
  },
  rmb_usd: {
    label: "RMB → USD",
    unit: "RMB/USD",
    icon: "language_chinese_dayi",
    color: "border-red-500/40",
  },
  rmb_bs: {
    label: "RMB → Bs",
    unit: "Bs/RMB",
    icon: "🔄",
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

  // Build rate lookup from live data
  const ratesByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of latestRates ?? []) {
      map.set(r.rateType, r.rate);
    }
    return map;
  }, [latestRates]);

  const bcv = ratesByType.get("bcv") ?? 1;
  const rmbUsd = ratesByType.get("rmb_usd") ?? 1;

  const computeConversion = () => {
    const amt = parseFloat(convertAmount) || 0;
    if (convertFrom === "usd" && convertTo === "bs") return amt * bcv;
    if (convertFrom === "bs" && convertTo === "usd") return amt / bcv;
    if (convertFrom === "rmb" && convertTo === "usd") return amt / rmbUsd;
    if (convertFrom === "usd" && convertTo === "rmb") return amt * rmbUsd;
    if (convertFrom === "rmb" && convertTo === "bs")
      return (amt / rmbUsd) * bcv;
    if (convertFrom === "bs" && convertTo === "rmb")
      return (amt / bcv) * rmbUsd;
    return amt;
  };

  // Build rate cards from live data with delta calculation
  const rateCards = useMemo(() => {
    return (latestRates ?? []).map((r) => {
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
      return {
        ...meta,
        type: r.rateType,
        value: r.rate,
        prev: prevRate,
        source: r.source ?? "—",
      };
    });
  }, [latestRates, rateHistory]);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Tasas de Cambio
        </h1>
        <p className="text-muted-foreground text-sm">
          Panel centralizado de tasas
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
                  <span className="text-xl">{rate.icon}</span>
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
                </div>
              </div>
            );
          })}
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
          <div className="flex-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5">
            <p className="text-primary/70 text-xs">Resultado</p>
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
                    <td className="text-muted-foreground px-4 py-3">
                      {entry.rateType.toUpperCase()}
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
