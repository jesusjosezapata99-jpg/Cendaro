"use client";

import { useState, lazy, Suspense } from "react";
import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const CreateClosureDialog = lazy(() => import("~/components/forms/create-closure").then(m => ({ default: m.CreateClosureDialog })));

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "Abierta", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400", icon: "lock_open" },
  closed: { label: "Cerrada", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", icon: "lock" },
  reviewed: { label: "Revisada", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400", icon: "verified" },
};

export default function CashClosurePage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data: closures, isLoading } = useQuery(trpc.sales.listClosures.queryOptions());

  const review = useMutation(
    trpc.sales.reviewClosure.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const items = closures ?? [];
  const todaySales = items[0]?.totalSales ?? 0;
  const totalDiscrepancies = items.reduce((s, c) => s + Math.abs(c.discrepancy ?? 0), 0);

  return (
    <>
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Cierre de Caja</h1>
          <p className="text-sm text-muted-foreground mt-1">Cierre diario y conciliación</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">lock_clock</span>
          Cerrar Día
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Ventas Hoy", value: `$${todaySales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "payments", accent: "border-emerald-500/40" },
          { label: "Efectivo Hoy", value: `$${(items[0]?.totalCash ?? 0).toFixed(2)}`, icon: "money", accent: "border-green-500/40" },
          { label: "Digital Hoy", value: `$${(items[0]?.totalDigital ?? 0).toFixed(2)}`, icon: "contactless", accent: "border-blue-500/40" },
          { label: "Discrepancias Total", value: `$${totalDiscrepancies.toFixed(2)}`, icon: "warning", accent: "border-red-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {items.map((closure) => {
            const cfg = STATUS_CFG[closure.status] ?? { label: closure.status, color: "bg-muted text-muted-foreground", icon: "help" };
            return (
              <div key={closure.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <span className="material-symbols-outlined text-xl">calendar_today</span>
                    </div>
                    <div>
                      <h3 className="font-mono text-lg font-bold text-foreground">
                        {new Date(closure.closureDate).toLocaleDateString()}
                      </h3>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${cfg.color}`}>
                    <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                    {cfg.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ventas</p>
                    <p className="font-mono text-sm font-bold text-foreground">${(closure.totalSales ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Efectivo</p>
                    <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">${(closure.totalCash ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Digital</p>
                    <p className="font-mono text-sm text-primary">${(closure.totalDigital ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Esperado</p>
                    <p className="font-mono text-sm text-muted-foreground">${(closure.expectedTotal ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Real</p>
                    <p className="font-mono text-sm text-muted-foreground">${(closure.actualTotal ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Discrepancia</p>
                    <p className={`font-mono text-sm font-bold ${
                      (closure.discrepancy ?? 0) === 0 ? "text-emerald-600 dark:text-emerald-400" : (closure.discrepancy ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {(closure.discrepancy ?? 0) >= 0 ? "+" : ""}{(closure.discrepancy ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {closure.status === "open" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => review.mutate({ id: closure.id })}
                      disabled={review.isPending}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {review.isPending ? "Cerrando..." : "Cerrar Caja"}
                    </button>
                  </div>
                )}
                {closure.status === "closed" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => review.mutate({ id: closure.id })}
                      disabled={review.isPending}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {review.isPending ? "Revisando..." : "Revisar y Aprobar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">point_of_sale</span>
          <p className="text-sm">No hay cierres registrados</p>
        </div>
      )}
    </div>

    <Suspense>
      <CreateClosureDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </Suspense>
    </>
  );
}
