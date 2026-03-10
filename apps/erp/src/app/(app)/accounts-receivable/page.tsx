"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/20 text-amber-400" },
  partial: { label: "Abono Parcial", color: "bg-blue-500/20 text-primary" },
  paid: { label: "Pagado", color: "bg-emerald-500/20 text-emerald-400" },
  overdue: { label: "Vencido", color: "bg-red-500/20 text-red-400" },
  written_off: {
    label: "Castigado",
    color: "bg-slate-500/20 text-muted-foreground",
  },
};

function computeDaysOverdue(dueDate: Date): number {
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff > 0 ? diff : 0;
}

export default function AccountsReceivablePage() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: arData, isLoading } = useQuery(
    trpc.vendor.listAR.queryOptions({}),
  );

  const items = arData ?? [];
  const filtered = items.filter(
    (ar) => statusFilter === "all" || ar.status === statusFilter,
  );

  const totalPending = items
    .filter((a) => a.status !== "paid")
    .reduce((s, a) => s + a.balance, 0);
  const overdueCount = items.filter((a) => a.status === "overdue").length;
  const overdueAmount = items
    .filter((a) => a.status === "overdue")
    .reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Cuentas por Cobrar
        </h1>
        <p className="text-muted-foreground text-sm">
          CxC, abonos y antigüedad de deuda
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "CxC Total",
            value: `$${totalPending.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: "💳",
            accent: "border-blue-500/40",
          },
          {
            label: "Cuentas Activas",
            value: items.filter((a) => a.status !== "paid").length,
            icon: "assignment",
            accent: "border-amber-500/40",
          },
          {
            label: "Vencidas",
            value: overdueCount,
            icon: "🚨",
            accent: "border-red-500/40",
          },
          {
            label: "Monto Vencido",
            value: `$${overdueAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: "warning",
            accent: "border-red-500/40",
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
              <span className="text-muted-foreground text-xs">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-black tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <div>
              <p className="font-medium text-red-400">
                {overdueCount} cuenta{overdueCount > 1 ? "s" : ""} vencida
                {overdueCount > 1 ? "s" : ""} por $
                {overdueAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-red-400/70">
                Revisar y gestionar cobranza inmediata
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2">
        {["all", "pending", "partial", "overdue", "paid"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* AR Table */}
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
                <th className="px-4 py-3 font-medium">Cliente ID</th>
                <th className="px-4 py-3 font-medium">Orden</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Abonado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Vence</th>
                <th className="px-4 py-3 text-right font-medium">Días Venc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ar) => {
                const cfg = STATUS_CONFIG[ar.status];
                const daysOverdue = computeDaysOverdue(ar.dueDate);
                return (
                  <tr
                    key={ar.id}
                    className={`border-border hover:bg-accent/50 border-b transition-colors ${ar.status === "overdue" ? "bg-red-900/5" : ""}`}
                  >
                    <td className="text-primary px-4 py-3 font-mono text-xs">
                      {ar.customerId.slice(0, 8)}…
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {ar.orderId?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg?.color ?? ""}`}
                      >
                        {cfg?.label ?? ar.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                      ${ar.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      ${ar.paidAmount.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold ${ar.balance > 0 ? "text-amber-400" : "text-emerald-400"}`}
                    >
                      ${ar.balance.toFixed(2)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {new Date(ar.dueDate).toLocaleDateString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold ${daysOverdue > 0 ? "text-red-400" : "text-muted-foreground"}`}
                    >
                      {daysOverdue > 0 ? `${daysOverdue}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            assignment
          </span>
          <p className="text-sm">
            No hay cuentas por cobrar{" "}
            {statusFilter !== "all"
              ? `con estado "${STATUS_CONFIG[statusFilter]?.label}"`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
