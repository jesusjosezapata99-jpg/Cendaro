"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { SheetBody, SheetFooter, SheetModal } from "~/components/sheet-modal";
import { Skeleton } from "~/components/skeleton";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface OrderDetailSheetProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda Física",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export function OrderDetailSheet({
  open,
  onClose,
  orderId,
}: OrderDetailSheetProps) {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const { data: order, isLoading } = useQuery(
    trpc.sales.orderById.queryOptions(
      { id: orderId },
      { enabled: open && Boolean(orderId) },
    ),
  );

  const { data: customer } = useQuery(
    trpc.sales.customerById.queryOptions(
      { id: order?.customerId ?? "" },
      { enabled: open && Boolean(order?.customerId) },
    ),
  );

  const status = order ? getStatus("order", order.status) : null;
  const dualTotal = formatDualCurrency(order?.total ?? 0, bcv.rate);

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={order ? `Pedido #${order.orderNumber}` : "Detalle de Pedido"}
      description="Resumen de orden de venta y estado logístico"
      maxWidth="sm:max-w-xl md:max-w-2xl"
    >
      {isLoading ? (
        <SheetBody>
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="border-border h-28 w-full border" />
            <Skeleton className="border-border h-36 w-full border" />
          </div>
        </SheetBody>
      ) : !order ? (
        <SheetBody>
          <div className="py-12 text-center">
            <Icons.ReceiptLong className="text-muted-foreground mx-auto mb-2 block size-9" />
            <p className="text-foreground font-medium">Pedido no encontrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              El pedido solicitado no existe o fue eliminado.
            </p>
          </div>
        </SheetBody>
      ) : (
        <div className="flex h-full flex-col">
          <SheetBody>
            <div className="space-y-5">
              {/* Header card */}
              <div className="border-border bg-card space-y-3 border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {status && (
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    )}
                    <span className="text-muted-foreground font-mono text-xs">
                      ·
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </span>
                  </div>
                  <time className="text-muted-foreground font-mono text-xs tabular-nums">
                    {new Date(order.createdAt).toLocaleDateString("es-VE")}
                  </time>
                </div>

                <div className="border-border/50 border-t pt-2 text-xs">
                  <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                    Cliente
                  </span>
                  <p className="text-foreground mt-0.5 font-medium">
                    {customer?.name ?? "Cliente Mostrador"}
                  </p>
                  {customer?.identification && (
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {customer.identification}
                    </p>
                  )}
                </div>
              </div>

              {/* Items preview table */}
              <div>
                <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Productos ({order.items.length})
                </h4>
                <div className="border-border bg-card divide-border/60 divide-y overflow-hidden border">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-foreground truncate font-medium">
                          {item.productName ?? "Producto"}
                        </p>
                        <p className="text-muted-foreground font-mono text-[11px]">
                          {item.sku ? `SKU: ${item.sku} · ` : ""}
                          {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                        </p>
                      </div>
                      <span className="text-foreground shrink-0 font-mono font-medium tabular-nums">
                        ${Number(item.lineTotal).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="border-border bg-card space-y-2 border p-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground font-mono tabular-nums">
                    ${Number(order.subtotal).toFixed(2)}
                  </span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-amber-500">
                    <span>Descuento</span>
                    <span className="font-mono tabular-nums">
                      -${Number(order.discount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-border/60 flex items-baseline justify-between border-t pt-2">
                  <span className="text-foreground font-medium">Total</span>
                  <div className="text-right">
                    <span className="text-primary font-mono text-base font-medium tabular-nums">
                      {dualTotal.usd}
                    </span>
                    {bcv.rate > 0 && (
                      <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                        {dualTotal.bs}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="border-border bg-card border p-3 text-xs">
                  <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                    Notas
                  </span>
                  <p className="text-foreground/80 mt-1 whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          </SheetBody>

          <SheetFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-11 text-xs"
              >
                Cerrar
              </Button>
              <Button asChild className="min-h-11 text-xs">
                <Link href={`/orders/${order.id}`} onClick={onClose}>
                  <Icons.OpenInNew className="size-4" />
                  Abrir Detalle Completo
                </Link>
              </Button>
            </div>
          </SheetFooter>
        </div>
      )}
    </SheetModal>
  );
}
