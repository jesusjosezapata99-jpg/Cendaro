"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const RegisterPaymentDialog = dynamic(
  () =>
    import("~/components/forms/register-payment").then((m) => ({
      default: m.RegisterPaymentDialog,
    })),
  { ssr: false },
);

interface MethodMeta {
  label: string;
  icon: IconName;
  tone: StatusTone;
}

const METHOD_CONFIG: Record<string, MethodMeta> = {
  mobile_payment: {
    label: "Pago Móvil",
    icon: "Smartphone",
    tone: "primary",
  },
  transfer: {
    label: "Transferencia",
    icon: "AccountBalance",
    tone: "primary",
  },
  cash: {
    label: "Efectivo",
    icon: "Payments",
    tone: "success",
  },
  pos_terminal: {
    label: "Punto de Venta",
    icon: "CreditCard",
    tone: "neutral",
  },
  zelle: {
    label: "Zelle",
    icon: "Bolt",
    tone: "warning",
  },
};

const cellPx = "px-4 py-3";

export default function PaymentsClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "validated"
  >("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [showRegister, setShowRegister] = useState(false);

  const { data: payments, isLoading } = useQuery(
    trpc.sales.listPayments.queryOptions({ limit: 100 }),
  );

  const validate = useMutation(
    trpc.sales.validatePayment.mutationOptions({
      onMutate: async ({ id }) => {
        const listKey = trpc.sales.listPayments.queryKey({ limit: 100 });
        await qc.cancelQueries({ queryKey: listKey });
        const previous = qc.getQueryData(listKey);
        if (previous) {
          qc.setQueryData(
            listKey,
            previous.map((p) =>
              p.id === id ? { ...p, isValidated: true } : p,
            ),
          );
        }
        return { previous, listKey };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          qc.setQueryData(context.listKey, context.previous);
        }
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["payments"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const rawItems = useMemo(() => payments ?? [], [payments]);

  // Overall metrics across all loaded payments
  const totalCollected = useMemo(
    () => rawItems.reduce((s, p) => s + Number(p.amount), 0),
    [rawItems],
  );
  const validatedCount = useMemo(
    () => rawItems.filter((p) => p.isValidated).length,
    [rawItems],
  );
  const pendingValidation = useMemo(
    () => rawItems.filter((p) => !p.isValidated).length,
    [rawItems],
  );

  // Method breakdown metrics
  const methodGroups = useMemo(() => {
    return rawItems.reduce<Record<string, { count: number; total: number }>>(
      (acc, p) => {
        const key = p.method;
        acc[key] ??= { count: 0, total: 0 };
        acc[key].count++;
        acc[key].total += Number(p.amount);
        return acc;
      },
      {},
    );
  }, [rawItems]);

  // Filtered view
  const filteredItems = useMemo(() => {
    return rawItems.filter((p) => {
      if (statusFilter === "pending" && p.isValidated) return false;
      if (statusFilter === "validated" && !p.isValidated) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      return true;
    });
  }, [rawItems, statusFilter, methodFilter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Pagos"
        description="Gestión, registro y conciliación de cobros comerciales"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor", "employee"]}>
            <Button
              onClick={() => setShowRegister(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Add className="size-4.5" />
              Registrar Pago
            </Button>
          </RoleGuard>
        }
      />

      <RegisterPaymentDialog
        open={showRegister}
        onClose={() => setShowRegister(false)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Cobrado"
          value={
            isLoading ? "—" : formatDualCurrency(totalCollected, bcv.rate).usd
          }
          sub={
            isLoading
              ? undefined
              : formatDualCurrency(totalCollected, bcv.rate).bs
          }
          icon="Payments"
          tone="primary"
        />
        <StatCard
          label="Transacciones"
          value={isLoading ? "—" : rawItems.length.toLocaleString("es-VE")}
          icon="ReceiptLong"
        />
        <StatCard
          label="Validados"
          value={isLoading ? "—" : validatedCount.toLocaleString("es-VE")}
          icon="CheckCircle"
          tone="success"
        />
        <StatCard
          label="Por Validar"
          value={isLoading ? "—" : pendingValidation.toLocaleString("es-VE")}
          icon="Pending"
          tone={pendingValidation > 0 ? "warning" : "default"}
        />
      </div>

      {/* Payment Method Breakdown Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(METHOD_CONFIG).map(([key, cfg]) => {
          const group = methodGroups[key];
          const isSelected = methodFilter === key;
          const groupTotal = group?.total ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                setMethodFilter((curr) => (curr === key ? "all" : key))
              }
              className={`border-border-subtle surface-card hover:border-primary/40 block rounded-xl border p-3.5 text-left transition-all ${
                isSelected ? "border-primary ring-primary/20 ring-2" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">
                  {cfg.label}
                </span>
                <Icon
                  name={cfg.icon}
                  className="text-muted-foreground size-4.5"
                />
              </div>
              <p className="text-foreground mt-2 font-mono text-xl font-medium tabular-nums">
                {group?.count ?? 0}
              </p>
              <div className="mt-1">
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  ${groupTotal.toFixed(2)}
                </p>
                {bcv.rate > 0 && groupTotal > 0 && (
                  <p className="text-muted-foreground/80 font-mono text-[10px] tabular-nums">
                    {formatDualCurrency(groupTotal, bcv.rate).bs}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Chips */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
        {[
          { id: "all", label: "Todos los Estados" },
          { id: "pending", label: "Por Validar" },
          { id: "validated", label: "Validados" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() =>
              setStatusFilter(f.id as "all" | "pending" | "validated")
            }
            className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="bg-border-subtle my-auto h-4 w-px shrink-0" />

        <button
          onClick={() => setMethodFilter("all")}
          className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            methodFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          Todos los Métodos
        </button>
        {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setMethodFilter(key)}
            className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              methodFilter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : filteredItems.map((p) => {
              const cfg = METHOD_CONFIG[p.method] ?? {
                label: p.method,
                icon: "Payments" as const,
                tone: "neutral" as StatusTone,
              };
              const amountNum = Number(p.amount);
              return (
                <div
                  key={p.id}
                  className="border-border-subtle surface-card rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={cfg.icon}
                        className="text-muted-foreground size-4.5"
                      />
                      <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                    </div>
                    {p.isValidated ? (
                      <StatusBadge tone="success">Validado</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Por Validar</StatusBadge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Monto
                      </p>
                      <p className="text-foreground font-mono text-base font-medium tabular-nums">
                        ${amountNum.toFixed(2)}
                      </p>
                      {bcv.rate > 0 && (
                        <p className="text-muted-foreground font-mono text-xs tabular-nums">
                          {formatDualCurrency(amountNum, bcv.rate).bs}
                        </p>
                      )}
                    </div>
                    {p.reference && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                          Referencia
                        </p>
                        <p className="text-foreground font-mono text-xs font-medium tabular-nums">
                          {p.reference}
                        </p>
                      </div>
                    )}
                  </div>

                  {(p.payerName ?? p.bankName) && (
                    <div className="border-border-subtle mt-3 flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground truncate">
                        {p.payerName ?? "—"}
                      </span>
                      {p.bankName && (
                        <span className="text-muted-foreground shrink-0 font-medium">
                          {p.bankName}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString("es-VE")}
                    </p>
                    {!p.isValidated && (
                      <RoleGuard
                        allow={["owner", "admin", "supervisor", "employee"]}
                      >
                        <button
                          type="button"
                          disabled={validate.isPending}
                          onClick={() => validate.mutate({ id: p.id })}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Validar
                        </button>
                      </RoleGuard>
                    )}
                  </div>
                </div>
              );
            })}

        {!isLoading && filteredItems.length === 0 && (
          <EmptyState
            icon="Payments"
            title="No se encontraron pagos"
            description="Ajusta los filtros seleccionados o registra un nuevo cobro comercial."
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
                Método
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Monto
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Referencia
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Pagador / Banco
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Fecha
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border-subtle border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : filteredItems.map((p) => {
                  const cfg = METHOD_CONFIG[p.method] ?? {
                    label: p.method,
                    icon: "Payments" as const,
                    tone: "neutral" as StatusTone,
                  };
                  const amountNum = Number(p.amount);
                  return (
                    <tr
                      key={p.id}
                      className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className={cellPx}>
                        <div className="flex items-center gap-2">
                          <Icon
                            name={cfg.icon}
                            className="text-muted-foreground size-4.5"
                          />
                          <span className="text-foreground text-xs font-medium">
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono font-medium tabular-nums`}
                      >
                        ${amountNum.toFixed(2)}
                        {bcv.rate > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs font-normal tabular-nums">
                            {formatDualCurrency(amountNum, bcv.rate).bs}
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {p.reference ?? "—"}
                      </td>
                      <td className={cellPx}>
                        <p className="text-foreground text-xs font-medium">
                          {p.payerName ?? "—"}
                        </p>
                        {p.bankName && (
                          <p className="text-muted-foreground text-[10px]">
                            {p.bankName}
                          </p>
                        )}
                      </td>
                      <td className={`${cellPx} text-center`}>
                        {p.isValidated ? (
                          <StatusBadge tone="success">Validado</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">Por Validar</StatusBadge>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {new Date(p.createdAt).toLocaleString("es-VE")}
                      </td>
                      <td className={`${cellPx} text-right`}>
                        {p.isValidated ? (
                          <span className="font-mono text-xs text-emerald-500 tabular-nums">
                            Conciliado
                          </span>
                        ) : (
                          <RoleGuard
                            allow={["owner", "admin", "supervisor", "employee"]}
                          >
                            <button
                              type="button"
                              disabled={validate.isPending}
                              onClick={() => validate.mutate({ id: p.id })}
                              className="border-border-subtle hover:border-primary hover:text-primary min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              Validar
                            </button>
                          </RoleGuard>
                        )}
                      </td>
                    </tr>
                  );
                })}

            {!isLoading && filteredItems.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={7} className="px-4 py-6">
                  <EmptyState
                    icon="Payments"
                    title="No se encontraron pagos"
                    description="Ajusta los filtros seleccionados o registra un nuevo cobro comercial."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
