"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { Can } from "~/components/role-guard";
import { StatCard } from "~/components/stat-card";
import { usePaymentParams } from "~/hooks/params/use-payment-params";
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

interface PaymentItem {
  id: string;
  orderId?: string | null;
  method: string;
  amount: string | number;
  reference?: string | null;
  payerName?: string | null;
  payerId?: string | null;
  bankName?: string | null;
  isValidated: boolean;
  notes?: string | null;
  createdAt: string | Date;
}

interface MethodMeta {
  label: string;
  icon: IconName;
}

const METHOD_CONFIG: Record<string, MethodMeta> = {
  mobile_payment: {
    label: "Pago Móvil",
    icon: "Smartphone",
  },
  transfer: {
    label: "Transferencia",
    icon: "AccountBalance",
  },
  cash: {
    label: "Efectivo",
    icon: "Payments",
  },
  pos_terminal: {
    label: "Punto de Venta",
    icon: "CreditCard",
  },
  zelle: {
    label: "Zelle",
    icon: "Bolt",
  },
};

export default function PaymentsClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "validated"
  >("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [{ registerPayment }, setPaymentParams] = usePaymentParams();

  const {
    data: payments,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.sales.listPayments.queryOptions({ limit: 100 }));

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

  const rawItems = useMemo(
    () => (payments ?? []) as unknown as PaymentItem[],
    [payments],
  );

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

  const columns = useMemo<ColumnDef<PaymentItem>[]>(
    () => [
      {
        accessorKey: "method",
        header: "Método",
        cell: ({ row }) => {
          const p = row.original;
          const cfg = METHOD_CONFIG[p.method] ?? {
            label: p.method,
            icon: "Payments" as const,
          };
          return (
            <div className="flex items-center gap-2">
              <Icon name={cfg.icon} className="text-muted-foreground size-4" />
              <span className="text-foreground text-xs font-medium">
                {cfg.label}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Monto</div>,
        cell: ({ row }) => {
          const amountNum = Number(row.original.amount);
          return (
            <div className="text-right font-mono font-medium tabular-nums">
              ${amountNum.toFixed(2)}
              {bcv.rate > 0 && (
                <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                  {formatDualCurrency(amountNum, bcv.rate).bs}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "reference",
        header: "Referencia",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.reference ?? "—"}
          </span>
        ),
      },
      {
        id: "payer",
        header: "Pagador / Banco",
        cell: ({ row }) => (
          <div>
            <p className="text-foreground text-xs font-medium">
              {row.original.payerName ?? "—"}
            </p>
            {row.original.bankName && (
              <p className="text-muted-foreground text-[10px]">
                {row.original.bankName}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: () => <div className="text-center">Estado</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <StatusPill tone={row.original.isValidated ? "success" : "warning"}>
              {row.original.isValidated ? "Validado" : "Por Validar"}
            </StatusPill>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acción</div>,
        cell: ({ row }) => {
          const p = row.original;
          if (p.isValidated) {
            return (
              <div className="text-right">
                <span className="font-mono text-xs text-emerald-500 tabular-nums">
                  Conciliado
                </span>
              </div>
            );
          }
          return (
            <div className="text-right">
              <Can module="payments" action="approve">
                <button
                  type="button"
                  disabled={validate.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    validate.mutate({ id: p.id });
                  }}
                  className="border-border hover:border-primary hover:text-primary h-8 border px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Validar
                </button>
              </Can>
            </div>
          );
        },
      },
    ],
    [bcv.rate, validate],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Pagos"
        description="Gestión, registro y conciliación de cobros comerciales"
        actions={
          <Can module="payments" action="create">
            <Button
              onClick={() => void setPaymentParams({ registerPayment: true })}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Add className="size-4.5" />
              Registrar Pago
            </Button>
          </Can>
        }
      />

      <RegisterPaymentDialog
        open={registerPayment}
        onClose={() => void setPaymentParams({ registerPayment: false })}
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
              className={`border-border bg-card hover:border-primary/40 block border p-3.5 text-left transition-colors ${
                isSelected ? "border-primary ring-primary/20 ring-1" : ""
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
            className={`h-9 shrink-0 border px-3 text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="bg-border my-auto h-4 w-px shrink-0" />

        <button
          onClick={() => setMethodFilter("all")}
          className={`h-9 shrink-0 border px-3 text-xs font-medium transition-colors ${
            methodFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          Todos los Métodos
        </button>
        {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setMethodFilter(key)}
            className={`h-9 shrink-0 border px-3 text-xs font-medium transition-colors ${
              methodFilter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Main Content: DataTable with loading, error, and empty states handled natively */}
      <DataTable
        columns={columns}
        data={filteredItems}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onResetFilters={
          statusFilter !== "all" || methodFilter !== "all"
            ? () => {
                setStatusFilter("all");
                setMethodFilter("all");
              }
            : undefined
        }
        emptyTitle="No se encontraron pagos"
        emptyDescription="Ajusta los filtros seleccionados o registra un nuevo cobro comercial."
      />
    </div>
  );
}
