"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { Dialog } from "~/components/dialog";
import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const UpdateQuoteStatusDialog = dynamic(
  () =>
    import("~/components/forms/update-quote-status").then((m) => ({
      default: m.UpdateQuoteStatusDialog,
    })),
  { ssr: false },
);

/** Quote status → semantic token chip (single source of truth). */
const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Enviada", tone: "primary" },
  accepted: { label: "Aceptada", tone: "success" },
  rejected: { label: "Rechazada", tone: "destructive" },
  expired: { label: "Expirada", tone: "warning" },
  converted: { label: "Convertida", tone: "success" },
};

/** Sales channels → human labels. */
const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/** Shared cell padding for tables. */
const cellPx = "px-4 py-3";

export default function QuoteDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  const { data: quote, isLoading } = useQuery(
    trpc.quotes.byId.queryOptions({ id }),
  );

  const convertMutation = useMutation(
    trpc.quotes.convertToOrder.mutationOptions({
      onSuccess: (order) => {
        void qc.invalidateQueries({ queryKey: [["quotes"]] });
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        setShowConvertConfirm(false);
        if (order?.id) {
          router.push(`/orders/${order.id}`);
        }
      },
    }),
  );

  const bcv = useBcvRate();

  /* Loading */
  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* Not found */
  if (!quote) {
    return (
      <div className="py-4 lg:py-8">
        <EmptyState
          icon="SearchOff"
          title="Cotización no encontrada"
          description="La cotización que buscas no existe o fue eliminada."
          action={
            <Button variant="outline" asChild>
              <Link href="/quotes">Volver a cotizaciones</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const st = STATUS_MAP[quote.status] ?? {
    label: quote.status,
    tone: "neutral" as StatusTone,
  };
  const total = Number(quote.total);
  const subtotal = Number(quote.subtotal);
  const discount = Number(quote.discount ?? 0);
  const items = quote.items;
  const canConvert =
    quote.status !== "converted" && quote.status !== "rejected";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/quotes"
            className="hover:text-foreground transition-colors"
          >
            Cotizaciones
          </Link>
          <Icons.ChevronRight className="size-4" aria-hidden />
          <span className="text-foreground font-medium">
            {quote.quoteNumber}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status === "converted" && quote.convertedOrderId && (
            <Button variant="outline" asChild className="min-h-11">
              <Link href={`/orders/${quote.convertedOrderId}`}>
                <Icons.ReceiptLong className="size-4.5" />
                Ver Pedido Vinculado
              </Link>
            </Button>
          )}

          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(true)}
              className="min-h-11"
            >
              <Icons.Edit className="size-4.5" />
              Cambiar Estado
            </Button>

            {canConvert && (
              <Button
                onClick={() => setShowConvertConfirm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11"
              >
                <Icons.TaskAlt className="size-4.5" />
                Convertir en Pedido
              </Button>
            )}
          </RoleGuard>
        </div>
      </div>

      {showStatusDialog && (
        <UpdateQuoteStatusDialog
          open={showStatusDialog}
          onClose={() => setShowStatusDialog(false)}
          quoteId={quote.id}
          currentStatus={quote.status}
        />
      )}

      {/* Convert Confirm Dialog */}
      {showConvertConfirm && (
        <Dialog
          open={showConvertConfirm}
          onClose={() => setShowConvertConfirm(false)}
          title="Convertir Cotización en Pedido"
          description={`¿Deseas convertir la cotización ${quote.quoteNumber} en un pedido formal de venta? Esta acción generará una orden con todas las líneas de productos correspondientes.`}
        >
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowConvertConfirm(false)}
              className="border-border-subtle hover:bg-accent min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate({ id: quote.id })}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {convertMutation.isPending
                ? "Convirtiendo..."
                : "Confirmar Conversión"}
            </button>
          </div>
        </Dialog>
      )}

      {/* Header Card */}
      <div className="border-border-subtle surface-card rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-foreground text-2xl font-medium tracking-tight">
                {quote.quoteNumber}
              </h1>
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-1">
                <Icons.Store className="size-4" aria-hidden />
                {CHANNEL_LABELS[quote.channel] ?? quote.channel}
              </span>
              <span className="flex items-center gap-1">
                <Icons.Schedule className="size-4" aria-hidden />
                {new Date(quote.createdAt).toLocaleString("es-VE")}
              </span>
              {quote.validUntil && (
                <span className="flex items-center gap-1">
                  <Icons.HourglassTop
                    className="size-4 text-amber-500"
                    aria-hidden
                  />
                  Vence:{" "}
                  {new Date(quote.validUntil).toLocaleDateString("es-VE")}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Propuesta"
          value={`$${total.toFixed(2)}`}
          sub={
            bcv.rate > 0 ? formatDualCurrency(total, bcv.rate).bs : undefined
          }
          icon="ReceiptLong"
          tone="primary"
        />
        <StatCard
          label="Subtotal"
          value={`$${subtotal.toFixed(2)}`}
          sub={
            bcv.rate > 0 ? formatDualCurrency(subtotal, bcv.rate).bs : undefined
          }
          icon="Payments"
        />
        <StatCard
          label="Descuento"
          value={discount > 0 ? `-$${discount.toFixed(2)}` : "—"}
          sub={
            discount > 0 && bcv.rate > 0
              ? formatDualCurrency(discount, bcv.rate).bs
              : undefined
          }
          icon="PriceChange"
          tone={discount > 0 ? "warning" : "default"}
        />
        <StatCard label="Estado" value={st.label} icon="Flag" />
      </div>

      {/* Metadata */}
      <section className="border-border-subtle surface-card rounded-xl border p-6">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
          Información de la Propuesta
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Número", value: quote.quoteNumber },
            {
              label: "Canal",
              value: CHANNEL_LABELS[quote.channel] ?? quote.channel,
            },
            { label: "Estado", value: st.label },
            {
              label: "Subtotal",
              value: `$${subtotal.toFixed(2)}`,
            },
            {
              label: "Descuento",
              value: discount > 0 ? `-$${discount.toFixed(2)}` : "—",
            },
            { label: "Total", value: `$${total.toFixed(2)}` },
            {
              label: "Validez",
              value: quote.validUntil
                ? new Date(quote.validUntil).toLocaleDateString("es-VE")
                : "Indefinida",
            },
            {
              label: "Creado",
              value: new Date(quote.createdAt).toLocaleDateString("es-VE"),
            },
          ].map((a) => (
            <div
              key={a.label}
              className="border-border-subtle flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="text-muted-foreground text-sm">{a.label}</span>
              <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                {a.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      {quote.notes && (
        <section className="border-border-subtle surface-card rounded-xl border p-6">
          <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
            Términos y Observaciones
          </h2>
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {quote.notes}
          </p>
        </section>
      )}

      {/* Items */}
      {items.length > 0 && (
        <section className="border-border-subtle surface-card gap-0 overflow-hidden rounded-xl border py-0">
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Productos Cotizados ({items.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Ítem / Ref
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Cantidad
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Precio Unit.
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Descuento
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Total Línea
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className={cellPx}>
                    <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                      {item.productId
                        ? `Prod #${item.productId.slice(0, 8)}`
                        : `Ítem #${idx + 1}`}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                  >
                    {item.quantity}
                  </TableCell>
                  <TableCell
                    className={`text-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                  >
                    ${Number(item.unitPrice).toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={`text-muted-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                  >
                    {item.discount && Number(item.discount) > 0
                      ? `-$${Number(item.discount).toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-foreground ${cellPx} text-right font-mono text-xs font-medium tabular-nums`}
                  >
                    ${Number(item.lineTotal).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
