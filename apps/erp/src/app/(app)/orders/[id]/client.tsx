"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import {
  Button,
  Input,
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
  const qc = useQueryClient();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [cnReason, setCnReason] = useState("");
  const [cnReturnToStock, setCnReturnToStock] = useState(true);
  const [cnWarehouseId, setCnWarehouseId] = useState("");
  const [cnRefundRef, setCnRefundRef] = useState("");

  const { data: order, isLoading } = useQuery(
    trpc.sales.orderById.queryOptions({ id }),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );
  const { data: creditNotes, refetch: refetchCreditNotes } = useQuery(
    trpc.creditNotes.list.queryOptions({ orderId: id }),
  );

  const createCreditNote = useMutation(
    trpc.creditNotes.create.mutationOptions({
      onSuccess: () => {
        toast.success("Nota de crédito emitida y enviada a aprobación");
        setShowCreditNoteForm(false);
        setCnReason("");
        setCnRefundRef("");
        void refetchCreditNotes();
        void qc.invalidateQueries({ queryKey: [["creditNotes"]] });
      },
      onError: (err) => {
        toast.error(err.message || "Error al emitir la nota de crédito");
      },
    }),
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
          <div className="flex items-center gap-2">
            {order.status !== "draft" && order.status !== "cancelled" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreditNoteForm((v) => !v)}
                className="gap-2"
              >
                <Icons.Description className="size-4" />
                Emitir Nota de Crédito
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusDialog(true)}
              className="gap-2"
            >
              <Icons.Sync className="size-4" />
              Cambiar estado
            </Button>
          </div>
        </RoleGuard>
      </div>

      {showCreditNoteForm ? (
        <section className="border-border bg-card space-y-4 border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-sm font-medium">
                Emitir Nota de Crédito / Devolución (PRD v2.0 §3.1)
              </h2>
              <p className="text-muted-foreground text-xs">
                Genera una nota de crédito vinculada a {order.orderNumber}{" "}
                sujeta a aprobación administrativa.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Motivo de la Devolución / Nota
              </label>
              <Input
                value={cnReason}
                onChange={(e) => setCnReason(e.target.value)}
                placeholder="Ej. Producto defectuoso / ajuste comercial"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Almacén de Retorno (si reingresa stock)
              </label>
              <select
                value={cnWarehouseId}
                onChange={(e) => setCnWarehouseId(e.target.value)}
                disabled={!cnReturnToStock}
                className="border-border bg-background text-foreground h-9 w-full border px-3 text-xs"
              >
                <option value="">Seleccionar almacén...</option>
                {(warehouses ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Ref. Reembolso Externo POS (Pago Móvil / Zelle / Efectivo)
              </label>
              <Input
                value={cnRefundRef}
                onChange={(e) => setCnRefundRef(e.target.value)}
                placeholder="Opcional si aplica a CxC"
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cnReturnToStock}
                onChange={(e) => setCnReturnToStock(e.target.checked)}
              />
              Reingresar unidades al inventario físico al aprobar
            </label>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreditNoteForm(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={
                  createCreditNote.isPending ||
                  cnReason.trim().length < 3 ||
                  (cnReturnToStock && !cnWarehouseId) ||
                  items.length === 0
                }
                onClick={() => {
                  createCreditNote.mutate({
                    orderId: order.id,
                    reason: cnReason.trim(),
                    returnToStock: cnReturnToStock,
                    warehouseId: cnReturnToStock ? cnWarehouseId : undefined,
                    exchangeRateBcv: bcv.rate > 0 ? bcv.rate : 1,
                    externalRefundReference: cnRefundRef.trim() || undefined,
                    items: items.map((it) => ({
                      productId: it.productId,
                      quantity: it.quantity,
                      unitPriceUsd: Number(it.unitPrice),
                    })),
                  });
                }}
              >
                {createCreditNote.isPending
                  ? "Emitiendo..."
                  : "Solicitar Nota de Crédito"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {(creditNotes ?? []).length > 0 ? (
        <section className="border-border bg-card border p-4">
          <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            Notas de Crédito Asociadas ({(creditNotes ?? []).length})
          </h2>
          <div className="divide-border divide-y text-xs">
            {(creditNotes ?? []).map((cn) => {
              const cnSt = getStatus("creditNote", cn.status);
              return (
                <div
                  key={cn.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-foreground font-mono font-medium">
                      {cn.creditNoteNumber}
                    </span>
                    <StatusPill tone={cnSt.tone}>{cnSt.label}</StatusPill>
                    <span className="text-muted-foreground">{cn.reason}</span>
                  </div>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    -${Number(cn.totalUsd).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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

      {/* Order & Customer metadata */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border bg-card border p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Cliente / Receptor
            </h2>
            {order.customer?.id && (
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Ver Ficha
                <Icons.OpenInNew className="size-3.5" />
              </Link>
            )}
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="border-border flex items-center justify-between gap-3 border p-3">
              <span className="text-muted-foreground">
                Nombre / Razón Social
              </span>
              <span className="text-foreground font-medium">
                {order.customer?.name ?? "Consumidor Final"}
              </span>
            </div>
            <div className="border-border flex items-center justify-between gap-3 border p-3">
              <span className="text-muted-foreground">RIF / Documento</span>
              <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                {order.customer?.identification ?? "—"}
              </span>
            </div>
            <div className="border-border flex items-center justify-between gap-3 border p-3">
              <span className="text-muted-foreground">Teléfono / Correo</span>
              <span className="text-foreground font-mono text-xs tabular-nums">
                {[order.customer?.phone, order.customer?.email]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </div>
            <div className="border-border flex items-center justify-between gap-3 border p-3">
              <span className="text-muted-foreground">Domicilio Fiscal</span>
              <span className="text-foreground truncate text-xs">
                {order.customer?.address ?? "—"}
              </span>
            </div>
          </div>
        </section>

        <section className="border-border bg-card border p-6">
          <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
            Información del Pedido
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
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
          {order.notes && (
            <div className="border-border mt-3 border p-3 text-xs">
              <span className="text-muted-foreground font-medium">Notas: </span>
              <span className="text-foreground">{order.notes}</span>
            </div>
          )}
        </section>
      </div>

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
