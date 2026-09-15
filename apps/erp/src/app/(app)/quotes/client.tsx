"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useQuoteParams } from "~/hooks/params/use-quote-params";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const CHANNEL_ICONS: Record<string, IconName> = {
  store: "Store",
  mercadolibre: "ShoppingCart",
  vendors: "LocalShipping",
  whatsapp: "Chat",
  instagram: "PhotoCamera",
};

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

interface QuoteListItem {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  status: string;
  channel: string;
  total: string | number;
  validUntil: Date | string | null;
  createdAt: Date | string;
}

const FILTER_STATUSES = [
  "all",
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;

export default function QuotesClient() {
  const trpc = useTRPC();
  const router = useRouter();
  const bcv = useBcvRate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, setQuoteParams] = useQuoteParams();

  const {
    data: quotes,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    trpc.quotes.list.queryOptions({
      limit: 50,
      status:
        statusFilter !== "all"
          ? (statusFilter as
              | "draft"
              | "sent"
              | "accepted"
              | "rejected"
              | "expired"
              | "converted")
          : undefined,
    }),
  );

  const list = useMemo(() => (quotes ?? []) as QuoteListItem[], [quotes]);
  const totalMonto = useMemo(
    () => list.reduce((s, q) => s + Number(q.total), 0),
    [list],
  );
  const aceptadasCount = useMemo(
    () =>
      list.filter((q) => q.status === "accepted" || q.status === "converted")
        .length,
    [list],
  );

  const columns = useMemo<ColumnDef<QuoteListItem>[]>(
    () => [
      {
        accessorKey: "quoteNumber",
        header: "Cotización",
        meta: { sticky: true, className: "w-44" },
        cell: ({ row }) => (
          <Link
            href={`/quotes/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground truncate font-mono text-xs font-medium tabular-nums hover:underline"
          >
            {row.original.quoteNumber}
          </Link>
        ),
      },
      {
        accessorKey: "channel",
        header: "Canal",
        meta: { className: "w-32" },
        cell: ({ row }) => {
          const ch = row.original.channel;
          const iconName = CHANNEL_ICONS[ch] ?? "RequestQuote";
          return (
            <div
              className="text-muted-foreground flex items-center gap-1.5 text-xs"
              title={CHANNEL_LABELS[ch] ?? ch}
            >
              <Icon name={iconName} className="size-4 shrink-0" />
              <span className="truncate">{CHANNEL_LABELS[ch] ?? ch}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const s = getStatus("quote", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const val = Number(row.original.total);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${val.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(val, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "validUntil",
        header: "Válida Hasta",
        meta: {
          className:
            "w-32 text-muted-foreground font-mono text-xs tabular-nums",
        },
        cell: ({ row }) => {
          const date = row.original.validUntil;
          if (!date) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {new Date(date).toLocaleDateString("es-VE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        meta: {
          className:
            "w-32 text-muted-foreground font-mono text-xs tabular-nums",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        ),
      },
    ],
    [bcv.rate],
  );

  const handleRowClick = useCallback(
    (quote: QuoteListItem) => {
      router.push(`/quotes/${quote.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Cotizaciones"
        description="Gestión de propuestas comerciales y presupuestos"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              onClick={() => void setQuoteParams({ createQuote: true })}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Add className="size-4.5" />
              Nueva Cotización
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Cotizaciones"
          value={isLoading ? "—" : list.length.toLocaleString("es-VE")}
          icon="RequestQuote"
        />
        <StatCard
          label="Total Cotizado"
          value={isLoading ? "—" : formatDualCurrency(totalMonto, bcv.rate).usd}
          sub={
            isLoading ? undefined : formatDualCurrency(totalMonto, bcv.rate).bs
          }
          icon="Payments"
          tone="primary"
        />
        <StatCard
          label="Aceptadas / Conv."
          value={isLoading ? "—" : aceptadasCount.toLocaleString("es-VE")}
          icon="CheckCircle"
          tone="success"
        />
      </div>

      {/* Filter tabs — Clean sharp style */}
      <div className="mobile-scroll-x flex items-center gap-1.5 border-b border-[--line] pb-2">
        {FILTER_STATUSES.map((s) => {
          const isSelected = statusFilter === s;
          const statusInfo = s === "all" ? null : getStatus("quote", s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex min-h-8 items-center border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
              }`}
            >
              {s === "all" ? "Todas" : statusInfo?.label}
            </button>
          );
        })}
      </div>

      {/* Main Data Table with 45px rows and virtualization */}
      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRowClick={handleRowClick}
        emptyTitle="No se encontraron cotizaciones"
        emptyDescription="Ajusta el filtro de estado o crea una nueva cotización para comenzar."
      />
    </div>
  );
}
