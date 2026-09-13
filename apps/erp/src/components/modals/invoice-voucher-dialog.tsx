"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

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
import { Skeleton } from "~/components/skeleton";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface InvoiceVoucherDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  pending_confirmation: { label: "Por Confirmar", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "primary" },
  prepared: { label: "Preparado", tone: "primary" },
  dispatched: { label: "Despachado", tone: "primary" },
  delivered: { label: "Entregado", tone: "success" },
  invoiced: { label: "Facturado", tone: "primary" },
  cancelled: { label: "Anulado", tone: "destructive" },
  returned: { label: "Devuelto", tone: "neutral" },
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia Bancaria",
  mobile_payment: "Pago Móvil",
  pos_terminal: "Punto de Venta",
  zelle: "Zelle / Divisas",
};

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda Física / Mostrador",
  mercadolibre: "Mercado Libre B2B",
  vendors: "Fuerza de Ventas",
  whatsapp: "Ventas WhatsApp",
  instagram: "Instagram Shop",
};

const DEMO_ORDER = {
  id: "preview",
  orderNumber: "ORD-9824-VEN",
  customerId: "demo-customer",
  channel: "store" as const,
  status: "invoiced" as const,
  subtotal: 350.0,
  discount: 35.0,
  total: 315.0,
  totalPaid: 315.0,
  createdAt: new Date("2026-09-06T10:30:00Z"),
  items: [
    {
      id: "item-1",
      productId: "prod-1",
      quantity: 4,
      unitPrice: 50.0,
      discount: 5.0,
      lineTotal: 180.0,
    },
    {
      id: "item-2",
      productId: "prod-2",
      quantity: 3,
      unitPrice: 50.0,
      discount: 5.0,
      lineTotal: 135.0,
    },
  ],
  payments: [
    {
      id: "pay-1",
      method: "transfer" as const,
      amount: 315.0,
      reference: "TRANSF-BNC-882194",
      bankName: "Banco Nacional de Crédito",
      payerName: "Distribuidora Industrial Los Andes C.A.",
    },
  ],
};

const DEMO_CUSTOMER = {
  name: "Distribuidora Industrial Los Andes C.A.",
  legalName: "Distribuidora Industrial Los Andes, Compañía Anónima",
  identification: "J-40918273-0",
  phone: "+58 412 555-4321",
  email: "ventas@losandesdist.com",
};

export function InvoiceVoucherDialog({
  open,
  onClose,
  orderId,
}: InvoiceVoucherDialogProps) {
  const trpc = useTRPC();
  const bcv = useBcvRate();
  const isPreview = orderId === "preview";

  const { data: dbOrder, isLoading: orderLoading } = useQuery(
    trpc.sales.orderById.queryOptions(
      { id: orderId ?? "" },
      { enabled: !!orderId && open && !isPreview },
    ),
  );

  const order = isPreview ? DEMO_ORDER : dbOrder;

  const { data: dbCustomer } = useQuery(
    trpc.sales.customerById.queryOptions(
      { id: order?.customerId ?? "" },
      { enabled: !!order?.customerId && open && !isPreview },
    ),
  );

  const customer = isPreview ? DEMO_CUSTOMER : dbCustomer;

  const { data: productsData } = useQuery(
    trpc.catalog.listProducts.queryOptions({ limit: 100 }, { enabled: open }),
  );

  const productMap = new Map<string, { name: string; sku: string }>(
    (productsData?.items ?? []).map((p) => [
      p.id,
      { name: p.name, sku: p.sku },
    ]),
  );

  if (isPreview) {
    productMap.set("prod-1", {
      name: "Batería Automotriz 12V 75Ah Cendaro Pro",
      sku: "BAT-12V-75",
    });
    productMap.set("prod-2", {
      name: "Aceite Sintético para Motor 5W-30 (Galón)",
      sku: "LUB-SYN-5W30",
    });
  }

  const isPaid = order ? Number(order.totalPaid) >= Number(order.total) : false;
  const isPartial =
    order &&
    Number(order.totalPaid) > 0 &&
    Number(order.totalPaid) < Number(order.total);

  const paymentTone: StatusTone = isPaid
    ? "success"
    : isPartial
      ? "warning"
      : "neutral";
  const paymentLabel = isPaid
    ? "Pagada"
    : isPartial
      ? "Pago Parcial"
      : "Pendiente de Pago";

  const statusTone = order
    ? (STATUS_MAP[order.status]?.tone ?? "neutral")
    : "neutral";
  const statusLabel = order
    ? (STATUS_MAP[order.status]?.label ?? order.status)
    : "—";

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Comprobante de Facturación Interna"
      description="Documento administrativo proforma y detalle de liquidación comercial"
      className="md:max-w-2xl"
    >
      {orderLoading ? (
        <div className="space-y-4 py-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : !order ? (
        <div className="py-12 text-center">
          <Icons.ReceiptLong className="text-muted-foreground mx-auto mb-2 block size-9" />
          <p className="text-foreground font-medium">Factura no encontrada</p>
          <p className="text-muted-foreground mt-1 text-sm">
            No se pudo obtener la información de esta orden de venta.
          </p>
        </div>
      ) : (
        <div className="space-y-6 pt-2 pb-4">
          {/* Header invoice badge & identifiers */}
          <div className="border-border-subtle bg-accent/20 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                  Factura Proforma Interna
                </span>
                <p className="text-primary font-mono text-xl font-black tracking-tight tabular-nums">
                  FAC-{order.orderNumber}
                </p>
                <p className="text-muted-foreground text-xs">
                  Ref. Orden:{" "}
                  <span className="font-mono font-medium">
                    {order.orderNumber}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                <StatusBadge tone={paymentTone}>{paymentLabel}</StatusBadge>
              </div>
            </div>
          </div>

          {/* 2-Column Meta details */}
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            {/* Customer Box */}
            <div className="border-border-subtle surface-card space-y-1.5 rounded-xl border p-3.5">
              <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                Receptor / Cliente
              </span>
              <p className="text-foreground text-sm font-medium">
                {customer?.name ?? "Cliente Mostrador / Ocasional"}
              </p>
              {customer?.legalName && (
                <p className="text-muted-foreground">{customer.legalName}</p>
              )}
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
                {customer?.email && (
                  <p>
                    <span className="text-foreground font-medium">Correo:</span>{" "}
                    {customer.email}
                  </p>
                )}
              </div>
            </div>

            {/* Commercial terms & Issuer Box */}
            <div className="border-border-subtle surface-card space-y-1.5 rounded-xl border p-3.5">
              <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                Emisión & Condiciones
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
                    Canal de Venta:
                  </span>{" "}
                  {CHANNEL_LABELS[order.channel] ?? order.channel}
                </p>
                <p>
                  <span className="text-foreground font-medium">
                    Tasa Oficial BCV:
                  </span>{" "}
                  <span className="font-mono tabular-nums">
                    Bs. {bcv.rate.toFixed(2)} / USD
                  </span>
                </p>
                <p>
                  <span className="text-foreground font-medium">Emisor:</span>{" "}
                  Cendaro Corp (RIF J-50123456-7)
                </p>
              </div>
            </div>
          </div>

          {/* Items breakdown table */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-foreground text-xs font-medium tracking-wider uppercase">
                Renglones Facturados ({order.items.length})
              </h4>
            </div>
            <div className="border-border-subtle surface-card overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 py-2 text-xs font-medium uppercase">
                      Ítem / Producto
                    </TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase">
                      Cant.
                    </TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase">
                      P. Unit
                    </TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase">
                      Total USD
                    </TableHead>
                    <TableHead className="hidden px-3 py-2 text-right text-xs font-medium uppercase sm:table-cell">
                      Total Bs.
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.length > 0 ? (
                    order.items.map((item) => {
                      const prod = productMap.get(item.productId);
                      const lineBs = formatDualCurrency(
                        item.lineTotal,
                        bcv.rate,
                      ).bs;
                      return (
                        <TableRow key={item.id} className="text-xs">
                          <TableCell className="px-3 py-2">
                            <p className="text-foreground font-medium">
                              {prod?.name ?? "Producto Comercial"}
                            </p>
                            {prod?.sku && (
                              <p className="text-muted-foreground font-mono text-[11px]">
                                SKU: {prod.sku}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                            ${Number(item.unitPrice).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-foreground px-3 py-2 text-right font-mono font-medium tabular-nums">
                            ${Number(item.lineTotal).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden px-3 py-2 text-right font-mono tabular-nums sm:table-cell">
                            {lineBs}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-6 text-center text-xs"
                      >
                        No se registraron renglones detallados para esta
                        factura.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Financial summary breakdown */}
          <div className="border-border-subtle surface-card space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums">
                ${Number(order.subtotal).toFixed(2)}
              </span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-xs font-medium text-emerald-500">
                <span>Descuento Comercial:</span>
                <span className="font-mono tabular-nums">
                  -${Number(order.discount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-border-subtle my-1 flex items-baseline justify-between border-t pt-2">
              <span className="text-foreground text-sm font-medium">
                Total Facturado (USD):
              </span>
              <span className="text-primary font-mono text-lg font-black tabular-nums">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Equivalente Legal BCV:</span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {formatDualCurrency(order.total, bcv.rate).bs}
              </span>
            </div>
            <div className="border-border-subtle my-1 flex justify-between border-t pt-2 text-xs">
              <span className="text-muted-foreground">
                Monto Pagado / Cobrado:
              </span>
              <span className="font-mono font-medium text-emerald-500 tabular-nums">
                ${Number(order.totalPaid ?? 0).toFixed(2)} (
                {formatDualCurrency(order.totalPaid ?? 0, bcv.rate).bs})
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Saldo Pendiente:</span>
              <span
                className={`font-mono tabular-nums ${
                  order.total - Number(order.totalPaid ?? 0) > 0.01
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                $
                {Math.max(
                  0,
                  order.total - Number(order.totalPaid ?? 0),
                ).toFixed(2)}{" "}
                (
                {
                  formatDualCurrency(
                    Math.max(0, order.total - Number(order.totalPaid ?? 0)),
                    bcv.rate,
                  ).bs
                }
                )
              </span>
            </div>
          </div>

          {/* Payments list if any */}
          {order.payments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-foreground text-xs font-medium tracking-wider uppercase">
                Historial de Pagos ({order.payments.length})
              </h4>
              <div className="space-y-1.5">
                {order.payments.map((p) => (
                  <div
                    key={p.id}
                    className="border-border-subtle surface-card flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="text-foreground font-medium">
                        {PAYMENT_METHODS[p.method] ?? p.method}
                      </span>
                      {p.reference && (
                        <span className="text-muted-foreground ml-2 font-mono">
                          Ref: {p.reference}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-medium text-emerald-500 tabular-nums">
                      ${Number(p.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="bg-muted/40 text-muted-foreground rounded-lg p-3 text-center text-[11px]">
            <Icons.Verified className="mr-1 size-3.5 align-middle" />
            Documento de control administrativo interno proforma emitido por el
            sistema Cendaro ERP.
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="min-h-10 text-xs"
            >
              <Icons.ReceiptLong className="size-4" />
              Imprimir Comprobante
            </Button>
            <Button variant="outline" asChild className="min-h-10 text-xs">
              <Link href={`/orders/${order.id}`}>
                <Icons.OpenInNew className="size-4" />
                Ver Pedido
              </Link>
            </Button>
            <Button
              variant="default"
              onClick={onClose}
              className="min-h-10 text-xs"
            >
              <Icons.Close className="size-4" />
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
