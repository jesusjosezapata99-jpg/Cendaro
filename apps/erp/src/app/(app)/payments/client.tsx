"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  mobile_payment: {
    label: "Pago Móvil",
    icon: "smartphone",
    color: "bg-blue-500/20 text-primary",
  },
  transfer: {
    label: "Transferencia",
    icon: "account_balance",
    color: "bg-violet-500/20 text-violet-400",
  },
  cash: {
    label: "Efectivo",
    icon: "payments",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  pos_terminal: {
    label: "Punto de Venta",
    icon: "credit_card",
    color: "bg-cyan-500/20 text-cyan-400",
  },
  zelle: {
    label: "Zelle",
    icon: "⚡",
    color: "bg-amber-500/20 text-amber-400",
  },
  binance: {
    label: "Binance",
    icon: "currency_bitcoin",
    color: "bg-yellow-500/20 text-yellow-400",
  },
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
  const bcv = useBcvRate();
  const pendingValidation = items.filter((p) => !p.isValidated).length;
  const validatedCount = items.filter((p) => p.isValidated).length;

  // Method breakdown
  const methodGroups = items.reduce<
    Record<string, { count: number; total: number }>
  >((acc, p) => {
    const key = p.method;
    acc[key] ??= { count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += p.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Pagos
        </h1>
        <p className="text-muted-foreground text-sm">
          Registro y validación de pagos
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Cobrado",
            value: formatDualCurrency(totalCollected, bcv.rate).usd,
            sub: formatDualCurrency(totalCollected, bcv.rate).bs,
            icon: "attach_money",
            accent: "border-emerald-500/40",
          },
          {
            label: "Pagos Registrados",
            value: items.length,
            icon: "receipt_long",
            accent: "border-blue-500/40",
          },
          {
            label: "Validados",
            value: validatedCount,
            icon: "check_circle",
            accent: "border-cyan-500/40",
          },
          {
            label: "Sin Validar",
            value: pendingValidation,
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
          </div>
        ))}
      </div>

      {/* Payment method breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(METHOD_CONFIG).map(([key, cfg]) => {
          const group = methodGroups[key];
          return (
            <div
              key={key}
              className="border-border bg-card rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-muted-foreground text-xl">
                  {cfg.icon}
                </span>
                <span className="text-muted-foreground text-xs">
                  {cfg.label}
                </span>
              </div>
              <p className="text-foreground mt-1 font-mono text-lg font-bold">
                {group?.count ?? 0}
              </p>
              <p className="text-muted-foreground text-xs">
                ${(group?.total ?? 0).toFixed(2)}
                {bcv.rate > 0 && (
                  <span className="ml-1 text-[10px]">
                    {formatDualCurrency(group?.total ?? 0, bcv.rate).bs}
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Payments Table */}
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
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Pagador</th>
                <th className="px-4 py-3 text-center font-medium">Validado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const cfg = METHOD_CONFIG[p.method] ?? {
                  label: p.method,
                  icon: "payment",
                  color: "bg-secondary text-foreground",
                };
                return (
                  <tr
                    key={p.id}
                    className="border-border hover:bg-accent/50 border-b transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                      ${p.amount.toFixed(2)}
                      {bcv.rate > 0 && (
                        <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                          {formatDualCurrency(p.amount, bcv.rate).bs}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {p.reference ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {p.payerName ?? "—"}
                    </td>
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
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
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
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            payments
          </span>
          <p className="text-sm">No hay pagos registrados</p>
        </div>
      )}
    </div>
  );
}
