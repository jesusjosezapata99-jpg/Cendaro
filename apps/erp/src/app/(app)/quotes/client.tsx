"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateQuoteDialog = dynamic(
  () =>
    import("~/components/forms/create-quote").then((m) => ({
      default: m.CreateQuoteDialog,
    })),
  { ssr: false },
);

/** Quote status → semantic token chip (single source of truth). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Enviada", tone: "primary" },
  accepted: { label: "Aceptada", tone: "success" },
  rejected: { label: "Rechazada", tone: "destructive" },
  expired: { label: "Expirada", tone: "warning" },
  converted: { label: "Convertida", tone: "success" },
};

const CHANNEL_ICONS: Record<string, string> = {
  store: "store",
  mercadolibre: "shopping_cart",
  vendors: "local_shipping",
  whatsapp: "chat",
  instagram: "photo_camera",
};

/** Shared cell padding for the quotes table. */
const cellPx = "px-4 py-3";

export default function QuotesClient() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: quotes, isLoading } = useQuery(
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

  const list = quotes ?? [];
  const bcv = useBcvRate();
  const totalMonto = list.reduce((s, q) => s + Number(q.total), 0);
  const aceptadasCount = list.filter(
    (q) => q.status === "accepted" || q.status === "converted",
  ).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Cotizaciones"
        description="Gestión de propuestas comerciales y presupuestos"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              onClick={() => setShowCreate(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nueva Cotización
            </Button>
          </div>
        }
      />

      <CreateQuoteDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Cotizaciones"
          value={isLoading ? "—" : list.length.toLocaleString("es-VE")}
          icon="request_quote"
        />
        <StatCard
          label="Total Cotizado"
          value={isLoading ? "—" : formatDualCurrency(totalMonto, bcv.rate).usd}
          sub={
            isLoading ? undefined : formatDualCurrency(totalMonto, bcv.rate).bs
          }
          icon="payments"
          tone="primary"
        />
        <StatCard
          label="Aceptadas / Conv."
          value={isLoading ? "—" : aceptadasCount.toLocaleString("es-VE")}
          icon="check_circle"
          tone="success"
        />
      </div>

      {/* Filter chips — wraps on mobile */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
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
            className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
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
          : list.map((quote) => {
              const statusCfg = STATUS_CONFIG[quote.status] ?? {
                label: quote.status,
                tone: "neutral" as StatusTone,
              };
              return (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="border-border-subtle surface-card hover:border-primary/30 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="material-symbols-outlined text-muted-foreground text-lg"
                        title={quote.channel}
                      >
                        {CHANNEL_ICONS[quote.channel] ?? "request_quote"}
                      </span>
                      <span className="text-primary font-mono text-sm font-semibold tabular-nums">
                        {quote.quoteNumber}
                      </span>
                    </div>
                    <StatusBadge tone={statusCfg.tone}>
                      {statusCfg.label}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Total
                      </p>
                      <p className="text-foreground font-mono font-semibold tabular-nums">
                        ${Number(quote.total).toFixed(2)}
                      </p>
                      {bcv.rate > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {formatDualCurrency(Number(quote.total), bcv.rate).bs}
                        </p>
                      )}
                    </div>
                    {quote.validUntil && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                          Válida hasta
                        </p>
                        <p className="text-muted-foreground font-mono text-xs tabular-nums">
                          {new Date(quote.validUntil).toLocaleDateString(
                            "es-VE",
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
                    {new Date(quote.createdAt).toLocaleString("es-VE")}
                  </p>
                </Link>
              );
            })}
        {!isLoading && list.length === 0 && (
          <EmptyState
            icon="request_quote"
            title="No se encontraron cotizaciones"
            description="Ajusta el filtro de estado o crea una nueva cotización para comenzar."
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
                Cotización
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Canal
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Total
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Válida hasta
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border-subtle border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : list.map((quote) => {
                  const statusCfg = STATUS_CONFIG[quote.status] ?? {
                    label: quote.status,
                    tone: "neutral" as StatusTone,
                  };
                  return (
                    <tr
                      key={quote.id}
                      className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className={cellPx}>
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="text-primary font-mono text-xs font-semibold tabular-nums hover:underline"
                        >
                          {quote.quoteNumber}
                        </Link>
                      </td>
                      <td className={cellPx}>
                        <span
                          aria-hidden
                          className="material-symbols-outlined text-muted-foreground text-lg"
                          title={quote.channel}
                        >
                          {CHANNEL_ICONS[quote.channel] ?? "request_quote"}
                        </span>
                      </td>
                      <td className={`${cellPx} text-center`}>
                        <StatusBadge tone={statusCfg.tone}>
                          {statusCfg.label}
                        </StatusBadge>
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono font-semibold tabular-nums`}
                      >
                        ${Number(quote.total).toFixed(2)}
                        {bcv.rate > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs font-normal tabular-nums">
                            {
                              formatDualCurrency(Number(quote.total), bcv.rate)
                                .bs
                            }
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {quote.validUntil
                          ? new Date(quote.validUntil).toLocaleDateString(
                              "es-VE",
                            )
                          : "—"}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {new Date(quote.createdAt).toLocaleString("es-VE")}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && list.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={6} className="px-4 py-6">
                  <EmptyState
                    icon="request_quote"
                    title="No se encontraron cotizaciones"
                    description="Ajusta el filtro de estado o crea una nueva cotización para comenzar."
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
