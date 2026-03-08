"use client";

import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const METHOD_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  mobile_payment: { label: "Pago Móvil", icon: "smartphone", color: "bg-blue-500/20 text-primary" },
  transfer: { label: "Transferencia", icon: "account_balance", color: "bg-violet-500/20 text-violet-400" },
  cash: { label: "Efectivo", icon: "payments", color: "bg-emerald-500/20 text-emerald-400" },
  pos_terminal: { label: "Punto de Venta", icon: "credit_card", color: "bg-cyan-500/20 text-cyan-400" },
  zelle: { label: "Zelle", icon: "⚡", color: "bg-amber-500/20 text-amber-400" },
  binance: { label: "Binance", icon: "currency_bitcoin", color: "bg-yellow-500/20 text-yellow-400" },
};

export default function PaymentsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: payments, isLoading } = useQuery(
    trpc.sales.listPayments.queryOptions({ limit: 50 }),
  );

  const validate = useMutation(
    trpc.sales.validatePayment.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
      },
    }),
  );

  const items = payments ?? [];
  const totalCollected = items.reduce((s, p) => s + p.amount, 0);
  const pendingValidation = items.filter((p) => !p.isValidated).length;
  const validatedCount = items.filter((p) => p.isValidated).length;

  // Method breakdown
  const methodGroups = items.reduce<Record<string, { count: number; total: number }>>((acc, p) => {
    const key = p.method;
    acc[key] ??= { count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += p.amount;
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Pagos</h1>
        <p className="text-sm text-muted-foreground">Registro y validación de pagos</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Cobrado", value: `$${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "attach_money", accent: "border-emerald-500/40" },
          { label: "Pagos Registrados", value: items.length, icon: "receipt_long", accent: "border-blue-500/40" },
          { label: "Validados", value: validatedCount, icon: "check_circle", accent: "border-cyan-500/40" },
          { label: "Sin Validar", value: pendingValidation, icon: "pending", accent: "border-amber-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Payment method breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(METHOD_CONFIG).map(([key, cfg]) => {
          const group = methodGroups[key];
          return (
            <div key={key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-muted-foreground">{cfg.icon}</span>
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">{group?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">${(group?.total ?? 0).toFixed(2)}</p>
            </div>
          );
        })}
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium text-right">Monto</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Pagador</th>
                <th className="px-4 py-3 font-medium text-center">Validado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const cfg = METHOD_CONFIG[p.method] ?? { label: p.method, icon: "payment", color: "bg-secondary text-foreground" };
                return (
                  <tr key={p.id} className="border-b border-border transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">${p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.payerName ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {p.isValidated ? (
                        <span className="text-emerald-400">✅</span>
                      ) : (
                        <button
                          onClick={() => validate.mutate({ id: p.id })}
                          disabled={validate.isPending}
                          className="rounded bg-amber-600/20 px-2 py-0.5 text-xs text-amber-400 transition-colors hover:bg-amber-600/40 disabled:opacity-50"
                        >
                          {validate.isPending ? "..." : "Validar"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">payments</span>
          <p className="text-sm">No hay pagos registrados</p>
        </div>
      )}
    </div>
  );
}
