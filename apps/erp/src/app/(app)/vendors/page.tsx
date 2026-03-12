"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

type FilterMode = "all" | "pending" | "paid";

export default function VendorsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");

  const { data: commissions, isLoading } = useQuery(
    trpc.vendor.allCommissions.queryOptions({ limit: 50 }),
  );

  const pay = useMutation(
    trpc.vendor.payCommission.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["vendor"]] });
      },
    }),
  );

  const items = commissions ?? [];
  const totalPending = items
    .filter((c) => !c.isPaid)
    .reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = items
    .filter((c) => c.isPaid)
    .reduce((s, c) => s + c.commissionAmount, 0);
  const _pendingCount = items.filter((c) => !c.isPaid).length;
  const bcv = useBcvRate();

  // Group by vendorId
  const vendorMap = new Map<
    string,
    { count: number; total: number; pending: number }
  >();
  for (const c of items) {
    const existing = vendorMap.get(c.vendorId) ?? {
      count: 0,
      total: 0,
      pending: 0,
    };
    existing.count++;
    existing.total += c.commissionAmount;
    if (!c.isPaid) existing.pending += c.commissionAmount;
    vendorMap.set(c.vendorId, existing);
  }

  // Filter items based on active filter
  const filteredItems =
    activeFilter === "all"
      ? items
      : activeFilter === "pending"
        ? items.filter((c) => !c.isPaid)
        : items.filter((c) => c.isPaid);

  const kpis = [
    {
      label: "Vendedores Activos",
      value: vendorMap.size,
      icon: "group",
      accent: "border-blue-500/40",
      filter: "all" as FilterMode,
    },
    {
      label: "Comisiones Totales",
      value: items.length,
      icon: "receipt_long",
      accent: "border-emerald-500/40",
      filter: "all" as FilterMode,
    },
    {
      label: "Comisiones Pendientes",
      value: formatDualCurrency(totalPending, bcv.rate).usd,
      sub: formatDualCurrency(totalPending, bcv.rate).bs,
      icon: "payments",
      accent: "border-amber-500/40",
      filter: "pending" as FilterMode,
    },
    {
      label: "Total Pagado",
      value: formatDualCurrency(totalPaid, bcv.rate).usd,
      sub: formatDualCurrency(totalPaid, bcv.rate).bs,
      icon: "check_circle",
      accent: "border-cyan-500/40",
      filter: "paid" as FilterMode,
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Portal de Vendedores
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestión de vendedores nacionales y comisiones
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {kpis.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setActiveFilter(stat.filter)}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card cursor-pointer border p-4 text-left transition-all ${
              activeFilter === stat.filter
                ? "border-primary/50 ring-primary/20 ring-2"
                : "border-border hover:border-primary/30 hover:bg-accent/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-xs">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-black tracking-tight">
              {stat.value}
            </p>
            {"sub" in stat && stat.sub && (
              <p className="text-muted-foreground text-xs">{stat.sub}</p>
            )}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {activeFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Filtrando:{" "}
            <span className="text-foreground font-bold">
              {activeFilter === "pending" ? "Pendientes" : "Pagadas"}
            </span>{" "}
            ({filteredItems.length} resultados)
          </span>
          <button
            onClick={() => setActiveFilter("all")}
            className="text-primary text-xs hover:underline"
          >
            Ver todas
          </button>
        </div>
      )}

      {/* Commissions Table */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          Comisiones{" "}
          {activeFilter === "pending"
            ? "Pendientes"
            : activeFilter === "paid"
              ? "Pagadas"
              : "Recientes"}{" "}
          ({filteredItems.length})
        </h2>
        {isLoading ? (
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
                  <th className="px-4 py-3 font-medium">Vendedor ID</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Total Venta
                  </th>
                  <th className="px-4 py-3 text-right font-medium">%</th>
                  <th className="px-4 py-3 text-right font-medium">Comisión</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border hover:bg-accent/50 border-b transition-colors"
                  >
                    <td className="text-primary px-4 py-3 font-mono text-xs">
                      {c.vendorId.slice(0, 8)}…
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                      ${c.orderTotal.toFixed(2)}
                      {bcv.rate > 0 && (
                        <span className="ml-1 text-[10px]">
                          {formatDualCurrency(c.orderTotal, bcv.rate).bs}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right">
                      {c.commissionPct}%
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                      ${c.commissionAmount.toFixed(2)}
                      {bcv.rate > 0 && (
                        <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                          {formatDualCurrency(c.commissionAmount, bcv.rate).bs}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.isPaid ? (
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Pagada
                        </span>
                      ) : (
                        <button
                          onClick={() => pay.mutate({ id: c.id })}
                          disabled={pay.isPending}
                          className="rounded bg-amber-600/20 px-2 py-0.5 text-xs text-amber-400 transition-colors hover:bg-amber-600/40 disabled:opacity-50"
                        >
                          {pay.isPending ? "..." : "Liquidar"}
                        </button>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredItems.length === 0 && !isLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            local_shipping
          </span>
          <p className="text-sm">
            {activeFilter === "all"
              ? "No hay comisiones registradas"
              : `No hay comisiones ${activeFilter === "pending" ? "pendientes" : "pagadas"}`}
          </p>
        </div>
      )}
    </div>
  );
}
