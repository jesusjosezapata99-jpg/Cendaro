"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
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
  const totalPending = items.filter((c) => !c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = items.filter((c) => c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const _pendingCount = items.filter((c) => !c.isPaid).length;

  // Group by vendorId
  const vendorMap = new Map<string, { count: number; total: number; pending: number }>();
  for (const c of items) {
    const existing = vendorMap.get(c.vendorId) ?? { count: 0, total: 0, pending: 0 };
    existing.count++;
    existing.total += c.commissionAmount;
    if (!c.isPaid) existing.pending += c.commissionAmount;
    vendorMap.set(c.vendorId, existing);
  }

  // Filter items based on active filter
  const filteredItems = activeFilter === "all"
    ? items
    : activeFilter === "pending"
      ? items.filter((c) => !c.isPaid)
      : items.filter((c) => c.isPaid);

  const kpis = [
    { label: "Vendedores Activos", value: vendorMap.size, icon: "group", accent: "border-blue-500/40", filter: "all" as FilterMode },
    { label: "Comisiones Totales", value: items.length, icon: "receipt_long", accent: "border-emerald-500/40", filter: "all" as FilterMode },
    { label: "Comisiones Pendientes", value: `$${totalPending.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "payments", accent: "border-amber-500/40", filter: "pending" as FilterMode },
    { label: "Total Pagado", value: `$${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "check_circle", accent: "border-cyan-500/40", filter: "paid" as FilterMode },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Portal de Vendedores</h1>
          <p className="text-sm text-muted-foreground">Gestión de vendedores nacionales y comisiones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {kpis.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setActiveFilter(stat.filter)}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border p-4 text-left transition-all cursor-pointer ${
              activeFilter === stat.filter ? "border-primary/50 ring-2 ring-primary/20" : "border-border hover:border-primary/30 hover:bg-accent/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {activeFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Filtrando: <span className="font-bold text-foreground">{activeFilter === "pending" ? "Pendientes" : "Pagadas"}</span>
            {" "}({filteredItems.length} resultados)
          </span>
          <button onClick={() => setActiveFilter("all")} className="text-xs text-primary hover:underline">Ver todas</button>
        </div>
      )}

      {/* Commissions Table */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Comisiones {activeFilter === "pending" ? "Pendientes" : activeFilter === "paid" ? "Pagadas" : "Recientes"}
          {" "}({filteredItems.length})
        </h2>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Vendedor ID</th>
                  <th className="px-4 py-3 font-medium text-right">Total Venta</th>
                  <th className="px-4 py-3 font-medium text-right">%</th>
                  <th className="px-4 py-3 font-medium text-right">Comisión</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((c) => (
                  <tr key={c.id} className="border-b border-border transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{c.vendorId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">${c.orderTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.commissionPct}%</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">${c.commissionAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {c.isPaid ? (
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">Pagada</span>
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
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">local_shipping</span>
          <p className="text-sm">{activeFilter === "all" ? "No hay comisiones registradas" : `No hay comisiones ${activeFilter === "pending" ? "pendientes" : "pagadas"}`}</p>
        </div>
      )}
    </div>
  );
}
