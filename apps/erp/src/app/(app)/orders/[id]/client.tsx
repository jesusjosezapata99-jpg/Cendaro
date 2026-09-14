"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const UpdateOrderStatusDialog = dynamic(
  () =>
    import("~/components/forms/update-order-status").then((m) => ({
      default: m.UpdateOrderStatusDialog,
    })),
  { ssr: false },
);

/** Payment method → semantic token chip. */
const PAYMENT_METHODS: Record<string, { label: string; tone: StatusTone }> = {
  cash: { label: "Efectivo", tone: "success" },
  transfer: { label: "Transferencia", tone: "info" },
  mobile_payment: { label: "Pago Móvil", tone: "info" },
  pos_terminal: { label: "Punto de Venta", tone: "info" },
  zelle: { label: "Zelle", tone: "warning" },
};

/** Sales channels → human labels. */
const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/** Sales channels → Material Symbols glyph (mirrors the orders list). */
const CHANNEL_ICONS: Record<string, IconName> = {
  store: "Store",
  mercadolibre: "ShoppingCart",
  vendors: "LocalShipping",
  whatsapp: "Chat",
  instagram: "PhotoCamera",
};

/** Shared cell padding for tables. */
const cellPx = "px-4 py-3";

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const { data: order, isLoading } = useQuery(
    trpc.sales.orderById.queryOptions({ id }),
  );

  const bcv = useBcvRate();

  /* Loading */
  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="border-border h-40 w-full border" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="border-border h-24 border" />
          ))}
        </div>
      </div>
    );
  }

  /* Not found */
  if (!order) {
    return (
      <div className="py-4 lg:py-8">
        <EmptyState
          icon="SearchOff"
          title="Pedido no encontrado"
          description="El pedido que buscas no existe o fue eliminado."
          action={
            <Button variant="outline" asChild>
              <Link href="/orders">Volver a pedidos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const st = getStatus("order", order.status);
  const totalPaid = Number(order.totalPaid);
  const total = Number(order.total);
  const balance = total - totalPaid;
  const payments = order.payments;
  const items = order.items;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/orders"
            className="hover:text-foreground transition-colors"
          >
            Pedidos
          </Link>
          <span>/</span>
          <span className="text-foreground font-mono font-medium">
            {order.orderNumber}
          </span>
        </div>
        <RoleGuard allow={["owner", "admin", "supervisor"]}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatusDialog(true)}
            className="gap-2"
          >
            <Icons.Sync className="size-4" />
            Cambiar estado
          </Button>
        </RoleGuard>
      </div>

      {showStatusDialog && (
        <UpdateOrderStatusDialog
          open={showStatusDialog}
          onClose={() => setShowStatusDialog(false)}
          orderId={order.id}
          currentStatus={order.status}
        />
      )}

      {/* Header */}
      <div className="border-border bg-card border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-foreground text-2xl font-medium tracking-tight">
                {order.orderNumber}
              </h1>
              <StatusPill tone={st.tone}>{st.label}</StatusPill>
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-1">
                <Icon
                  name={CHANNEL_ICONS[order.channel] ?? "Store"}
                  className="size-4"
                />
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </span>
              <span className="flex items-center gap-1">
                <Icons.Schedule className="size-4" aria-hidden />
                {new Date(order.createdAt).toLocaleString("es-VE")}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={`$${total.toFixed(2)}`}
          sub={
            bcv.rate > 0 ? formatDualCurrency(total, bcv.rate).bs : undefined
          }
          icon="ReceiptLong"
          tone="primary"
        />
        <StatCard
          label="Cobrado"
          value={`$${totalPaid.toFixed(2)}`}
          sub={
            bcv.rate > 0
              ? formatDualCurrency(totalPaid, bcv.rate).bs
              : undefined
          }
          icon="CheckCircle"
          tone="success"
        />
        <StatCard
          label="Saldo"
          value={`$${balance.toFixed(2)}`}
          sub={
            bcv.rate > 0 ? formatDualCurrency(balance, bcv.rate).bs : undefined
          }
          icon="AccountBalanceWallet"
          tone={balance > 0 ? "warning" : "success"}
        />
        <StatCard label="Estado" value={st.label} icon="Flag" />
      </div>

      {/* Order metadata */}
      <section className="border-border bg-card border p-6">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
          Información del Pedido
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Número", value: order.orderNumber },
            {
              label: "Canal",
              value: CHANNEL_LABELS[order.channel] ?? order.channel,
            },
            { label: "Estado", value: st.label },
            {
              label: "Subtotal",
              value: `$${Number(order.subtotal).toFixed(2)}`,
            },
            {
              label: "Descuento",
              value: order.discount
                ? `-$${Number(order.discount).toFixed(2)}`
                : "—",
            },
            { label: "Total", value: `$${total.toFixed(2)}` },
            { label: "Pagado", value: `$${totalPaid.toFixed(2)}` },
            { label: "Saldo", value: `$${balance.toFixed(2)}` },
            {
              label: "Creado",
              value: new Date(order.createdAt).toLocaleDateString("es-VE"),
            },
          ].map((a) => (
            <div
              key={a.label}
              className="border-border flex items-center justify-between gap-3 border p-3"
            >
              <span className="text-muted-foreground text-sm">{a.label}</span>
              <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                {a.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Items */}
      {items.length > 0 && (
        <section className="border-border bg-card gap-0 overflow-hidden border py-0">
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Productos ({items.length})
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
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-medium">
                        {item.productName ??
                          (item.productId
                            ? `Prod #${item.productId.slice(0, 8)}`
                            : `Ítem #${idx + 1}`)}
                      </span>
                      {item.sku ? (
                        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                          {item.sku}
                        </span>
                      ) : null}
                    </div>
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

      {/* Payments */}
      {payments.length > 0 && (
        <section className="border-border bg-card gap-0 overflow-hidden border py-0">
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Pagos ({payments.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Método
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                >
                  Monto
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Referencia
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Fecha
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const method = PAYMENT_METHODS[p.method] ?? {
                  label: p.method,
                  tone: "neutral" as StatusTone,
                };
                return (
                  <TableRow key={p.id}>
                    <TableCell className={cellPx}>
                      <StatusPill tone={method.tone}>{method.label}</StatusPill>
                    </TableCell>
                    <TableCell
                      className={`text-foreground ${cellPx} text-right font-mono font-medium tabular-nums`}
                    >
                      ${Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                    >
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                    >
                      {new Date(p.createdAt).toLocaleString("es-VE")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
