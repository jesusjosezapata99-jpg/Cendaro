"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: {
    label: "Borrador",
    color:
      "bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400",
  },
  sent: {
    label: "Enviada",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  accepted: {
    label: "Aceptada",
    color:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "Rechazada",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
  expired: {
    label: "Expirada",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  converted: {
    label: "Convertida",
    color:
      "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400",
  },
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

export default function QuotesClient() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quotes, isLoading } = useQuery(
    trpc.quotes.list.queryOptions({ limit: 50 }),
  );

  const list = quotes ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Cotizaciones
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona cotizaciones y conviértelas en órdenes de venta
          </p>
        </div>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors">
          <span className="material-symbols-outlined text-lg">add</span>
          Nueva Cotización
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Cotizaciones",
            value: isLoading ? "—" : list.length,
            icon: "request_quote",
            accent: "border-blue-500/40",
          },
          {
            label: "Aceptadas",
            value: isLoading
              ? "—"
              : list.filter((q) => q.status === "accepted").length,
            icon: "check_circle",
            accent: "border-emerald-500/40",
          },
          {
            label: "Pendientes",
            value: isLoading
              ? "—"
              : list.filter((q) => q.status === "sent" || q.status === "draft")
                  .length,
            icon: "pending",
            accent: "border-amber-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          "all",
          "draft",
          "sent",
          "accepted",
          "rejected",
          "expired",
          "converted",
        ].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-widest uppercase">
              <th className="px-4 py-3">Cotización</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Válida hasta</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="mx-auto h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                  </tr>
                ))
              : list
                  .filter(
                    (q) => statusFilter === "all" || q.status === statusFilter,
                  )
                  .map((quote) => {
                    const cfg = STATUS_CONFIG[quote.status] ?? {
                      label: quote.status,
                      color: "",
                    };
                    return (
                      <tr
                        key={quote.id}
                        className="border-border hover:bg-accent/50 border-b transition-colors"
                      >
                        <td className="text-primary px-4 py-3 font-mono text-xs font-bold">
                          {quote.quoteNumber}
                        </td>
                        <td className="text-foreground px-4 py-3">
                          {quote.customerId ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                          ${Number(quote.total).toFixed(2)}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                          {quote.validUntil
                            ? new Date(quote.validUntil).toLocaleDateString(
                                "es-VE",
                              )
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
            {!isLoading && list.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  <span className="material-symbols-outlined mb-2 block text-3xl">
                    description
                  </span>
                  No hay cotizaciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
