"use client";

import Link from "next/link";
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
import { StatusPill } from "@cendaro/ui/status-pill";

import { SheetBody, SheetFooter, SheetModal } from "~/components/sheet-modal";
import { Skeleton } from "~/components/skeleton";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface DeliveryNoteVoucherDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  store: "Mostrador / Retiro en Tienda",
  mercadolibre: "Mercado Libre Envíos",
  vendors: "Despacho Preventa",
  whatsapp: "Delivery WhatsApp",
  instagram: "Delivery Redes",
};

const DEMO_DELIVERY = {
  id: "preview",
  orderNumber: "ORD-9824-VEN",
  customerId: "demo-customer",
  channel: "vendors" as const,
  status: "dispatched" as const,
  subtotal: 350.0,
  discount: 35.0,
  total: 315.0,
  createdAt: new Date(),
  items: [
    {
      id: "item-1",
      productId: "prod-1",
      productName: "Batería Automotriz 12V 75Ah Cendaro Pro",
      sku: "BAT-12V-75",
      quantity: 2,
      unitPrice: 120.0,
      discount: 10.0,
      lineTotal: 230.0,
    },
    {
      id: "item-2",
      productId: "prod-2",
      productName: "Aceite Sintético para Motor 5W-30 (Galón)",
      sku: "LUB-SYN-5W30",
      quantity: 3,
      unitPrice: 35.0,
      discount: 0,
      lineTotal: 105.0,
    },
  ],
};

export function DeliveryNoteVoucherDialog({
  open,
  onClose,
  orderId,
}: DeliveryNoteVoucherDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const isDemo = orderId === "preview";

  const { data: realOrder, isLoading: orderLoading } = useQuery(
    trpc.sales.orderById.queryOptions(
      {
        id:
          orderId && !isDemo ? orderId : "00000000-0000-0000-0000-000000000000",
      },
      { enabled: open && !!orderId && !isDemo },
    ),
  );

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions(
      { limit: 100 },
      { enabled: open && !!orderId },
    ),
  );

  const updateStatus = useMutation(
    trpc.sales.updateOrderStatus.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["sales", "orderById"]] });
      },
    }),
  );

  const order = isDemo ? DEMO_DELIVERY : realOrder;

  const customer = isDemo
    ? {
        name: "Distribuidora Industrial del Centro C.A.",
        identification: "J-30982145-0",
        phone: "+58 414-555-0199",
        address: "Av. Principal Los Guayos, Galpón 4, Valencia, Edo. Carabobo",
      }
    : customersData?.find((c) => c.id === order?.customerId);

  const st = order
    ? getStatus("deliveryNote", order.status)
    : { label: "—", tone: "neutral" as const };

  const totalItemsCount =
    order?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleAdvanceStatus = () => {
    if (!order) return;
    if (order.status === "confirmed" || order.status === "prepared") {
      updateStatus.mutate({ id: order.id, status: "dispatched" });
    } else if (order.status === "dispatched") {
      updateStatus.mutate({ id: order.id, status: "delivered" });
    }
  };

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Guía de Despacho & Nota de Entrega"
      description="Documento de control logístico, salida de inventario y recepción física"
      maxWidth="sm:max-w-2xl md:max-w-3xl"
    >
      {orderLoading ? (
        <SheetBody>
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </SheetBody>
      ) : !order ? (
        <SheetBody>
          <div className="py-12 text-center">
            <Icons.LocalShipping className="text-muted-foreground mx-auto mb-2 block size-9" />
            <p className="text-foreground font-medium">
              Nota de entrega no encontrada
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              No se pudo obtener la información de esta guía de despacho.
            </p>
          </div>
        </SheetBody>
      ) : (
        <div className="flex h-full flex-col">
          <SheetBody>
            <div className="space-y-6 pt-2 pb-4">
              {/* Header delivery badge & identifiers */}
              <div className="border-border bg-card border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                      Guía de Despacho / Nota de Entrega
                    </span>
                    <p className="text-primary font-mono text-xl font-medium tracking-tight tabular-nums">
                      NE-{order.orderNumber}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Orden de Venta:{" "}
                      <span className="font-mono font-medium">
                        {order.orderNumber}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </div>
                </div>
              </div>

              {/* 2-Column Logistics Details */}
              <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                {/* Destinatario Box */}
                <div className="border-border bg-card space-y-1.5 border p-3.5">
                  <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                    Consignatario / Destino
                  </span>
                  <p className="text-foreground text-sm font-medium">
                    {customer?.name ?? "Cliente Mostrador / Retiro"}
                  </p>
                  <div className="text-muted-foreground space-y-0.5 pt-1">
                    {customer?.identification && (
                      <p>
                        <span className="text-foreground font-medium">
                          RIF / C.I.:
                        </span>{" "}
                        {customer.identification}
                      </p>
                    )}
                    {customer?.phone && (
                      <p>
                        <span className="text-foreground font-medium">
                          Teléfono:
                        </span>{" "}
                        {customer.phone}
                      </p>
                    )}
                    <p>
                      <span className="text-foreground font-medium">
                        Dirección:
                      </span>{" "}
                      {customer?.address ?? "Retiro en almacén principal"}
                    </p>
                  </div>
                </div>

                {/* Logistics & Origin Box */}
                <div className="border-border bg-card space-y-1.5 border p-3.5">
                  <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                    Control de Despacho
                  </span>
                  <div className="text-muted-foreground space-y-1">
                    <p>
                      <span className="text-foreground font-medium">
                        Fecha Emisión:
                      </span>{" "}
                      {new Date(order.createdAt).toLocaleDateString("es-VE")}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">
                        Modalidad:
                      </span>{" "}
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">
                        Bultos / Piezas:
                      </span>{" "}
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {totalItemsCount} unidades
                      </span>
                    </p>
                    <p>
                      <span className="text-foreground font-medium">
                        Almacén Origen:
                      </span>{" "}
                      Almacén Principal Central (WH-01)
                    </p>
                  </div>
                </div>
              </div>

              {/* Items to dispatch table */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-foreground text-xs font-medium tracking-wider uppercase">
                    Mercancía a Despachar ({order.items.length} renglones)
                  </h4>
                </div>
                <div className="border-border bg-card overflow-hidden border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-3 py-2 text-xs font-medium uppercase">
                          Ítem / Producto
                        </TableHead>
                        <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase">
                          Cant. Solicitada
                        </TableHead>
                        <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase">
                          Cant. Despachada
                        </TableHead>
                        <TableHead className="px-3 py-2 text-center text-xs font-medium uppercase">
                          Verificación
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.length > 0 ? (
                        order.items.map((item) => {
                          return (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="px-3 py-2">
                                <p className="text-foreground font-medium">
                                  {item.productName ?? "Producto Comercial"}
                                </p>
                                {item.sku ? (
                                  <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                                    SKU: {item.sku}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-foreground px-3 py-2 text-right font-mono font-medium tabular-nums">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-center">
                                <Icons.CheckCircle className="size-4 text-emerald-500" />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-muted-foreground py-6 text-center text-xs"
                          >
                            No se registraron renglones para este despacho.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Declared Value & Currency */}
              <div className="border-border bg-card flex flex-wrap items-center justify-between border p-3.5 text-xs">
                <span className="text-muted-foreground font-medium">
                  Valor Comercial Declarado:
                </span>
                <div className="text-right">
                  <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                    ${Number(order.total).toFixed(2)} USD
                  </span>
                  <span className="text-muted-foreground ml-2 font-mono tabular-nums">
                    ({formatDualCurrency(order.total, bcv.rate).bs})
                  </span>
                </div>
              </div>

              {/* Delivery Signatures Box */}
              <div className="space-y-2">
                <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                  Control de Entrega y Firmas de Conformidad
                </span>
                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                  <div className="border-border bg-card flex h-24 flex-col justify-between border p-3">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase">
                      1. Despachado por (Almacén)
                    </span>
                    <div className="border-border text-muted-foreground border-t pt-1 text-[11px]">
                      Firma / Cédula / Fecha
                    </div>
                  </div>
                  <div className="border-border bg-card flex h-24 flex-col justify-between border p-3">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase">
                      2. Transportista / Chofer
                    </span>
                    <div className="border-border text-muted-foreground border-t pt-1 text-[11px]">
                      Nombre / Placa / Firma
                    </div>
                  </div>
                  <div className="border-border bg-card flex h-24 flex-col justify-between border p-3">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase">
                      3. Recibido Conforme (Cliente)
                    </span>
                    <div className="border-border text-muted-foreground border-t pt-1 text-[11px]">
                      Firma / Sello / C.I.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(order.status === "confirmed" ||
                order.status === "prepared") && (
                <Button
                  variant="default"
                  disabled={updateStatus.isPending}
                  onClick={handleAdvanceStatus}
                  className="min-h-10 text-xs"
                >
                  <Icons.FlightTakeoff className="size-4" />
                  {updateStatus.isPending
                    ? "Actualizando..."
                    : "Marcar en Tránsito"}
                </Button>
              )}
              {order.status === "dispatched" && (
                <Button
                  variant="default"
                  disabled={updateStatus.isPending}
                  onClick={handleAdvanceStatus}
                  className="min-h-10 text-xs"
                >
                  <Icons.CheckCircle className="size-4" />
                  {updateStatus.isPending
                    ? "Actualizando..."
                    : "Confirmar Entrega"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handlePrint}
                className="min-h-10 text-xs"
              >
                <Icons.LocalShipping className="size-4" />
                Imprimir Guía
              </Button>
              <Button variant="outline" asChild className="min-h-10 text-xs">
                <Link href={`/orders/${order.id}`}>
                  <Icons.OpenInNew className="size-4" />
                  Ver Pedido
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="min-h-10 text-xs"
              >
                <Icons.Close className="size-4" />
                Cerrar
              </Button>
            </div>
          </SheetFooter>
        </div>
      )}
    </SheetModal>
  );
}

export const DeliveryNoteVoucherSheet = DeliveryNoteVoucherDialog;
