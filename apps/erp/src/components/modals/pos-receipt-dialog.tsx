"use client";

import { useMemo } from "react";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { CartLine } from "./pos-checkout-dialog";
import { Dialog } from "~/components/dialog";
import { formatDualCurrency } from "~/lib/format-currency";

export interface PosReceiptData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerIdentification?: string;
  items: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  payments: {
    method: string;
    amount: number;
    currency: string;
    reference?: string;
    bankName?: string;
  }[];
  changeUsd: number;
  changeBs: number;
  bcvRate: number;
  date: Date;
}

interface PosReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: PosReceiptData | null;
  onNewSale: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  mobile_payment: "Pago Móvil",
  pos_terminal: "Punto de Venta",
  transfer: "Transferencia",
  zelle: "Zelle",
};

export function PosReceiptDialog({
  open,
  onClose,
  receipt,
  onNewSale,
}: PosReceiptDialogProps) {
  const dualTotal = useMemo(() => {
    if (!receipt) return { usd: "$0.00", bs: "Bs 0,00" };
    return formatDualCurrency(receipt.total, receipt.bcvRate);
  }, [receipt]);

  const dualSubtotal = useMemo(() => {
    if (!receipt) return { usd: "$0.00", bs: "Bs 0,00" };
    return formatDualCurrency(receipt.subtotal, receipt.bcvRate);
  }, [receipt]);

  const dualDiscount = useMemo(() => {
    if (!receipt) return { usd: "$0.00", bs: "Bs 0,00" };
    return formatDualCurrency(receipt.discount, receipt.bcvRate);
  }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleFinish = () => {
    onClose();
    onNewSale();
  };

  const formattedDate = receipt.date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedTime = receipt.date.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Dialog
      open={open}
      onClose={handleFinish}
      title="Comprobante de Venta — Ticket POS"
      description={`Orden ${receipt.orderNumber} procesada con éxito.`}
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Thermal Slip Simulation Container */}
        <div
          id="pos-thermal-slip"
          className="border-border bg-card text-foreground rounded-xl border p-5 shadow-xs"
        >
          {/* Slip Header */}
          <div className="space-y-1 text-center">
            <h3 className="text-foreground text-sm font-black tracking-wider uppercase">
              Cendaro ERP — Mostrador
            </h3>
            <p className="text-muted-foreground font-mono text-xs">
              RIF: J-50492819-0
            </p>
            <p className="text-muted-foreground text-xs">
              Sucursal Principal · Caracas, Venezuela
            </p>
            <div className="text-muted-foreground font-mono text-xs tabular-nums">
              Fecha: {formattedDate} · {formattedTime}
            </div>
            <div className="border-border/60 my-2 border-t border-dashed" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ticket / Factura:</span>
              <span className="text-foreground font-mono font-medium">
                {receipt.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="text-foreground font-medium">
                {receipt.customerName}
              </span>
            </div>
            {receipt.customerIdentification && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Documento:</span>
                <span className="text-foreground font-mono">
                  {receipt.customerIdentification}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tasa Oficial BCV:</span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                Bs{" "}
                {receipt.bcvRate.toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="border-border/60 my-3 border-t border-dashed" />

          {/* Items Table */}
          <div className="space-y-2">
            <div className="text-muted-foreground grid grid-cols-12 text-xs font-medium uppercase">
              <span className="col-span-2 text-center">Cant</span>
              <span className="col-span-6">Descripción</span>
              <span className="col-span-4 text-right">Total</span>
            </div>
            <div className="divide-border/40 divide-y">
              {receipt.items.map((item, idx) => {
                const itemDual = formatDualCurrency(
                  item.lineTotal,
                  receipt.bcvRate,
                );
                return (
                  <div key={idx} className="grid grid-cols-12 py-1.5 text-xs">
                    <span className="text-foreground col-span-2 text-center font-mono font-medium tabular-nums">
                      {item.quantity}
                    </span>
                    <div className="col-span-6 pr-1">
                      <p className="text-foreground line-clamp-2 leading-tight font-medium">
                        {item.name}
                      </p>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {item.sku} · ${item.unitPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-4 text-right font-mono tabular-nums">
                      <div className="text-foreground font-medium">
                        {itemDual.usd}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {itemDual.bs}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-border/60 my-3 border-t border-dashed" />

          {/* Financial Breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="text-foreground font-mono tabular-nums">
                {dualSubtotal.usd}
              </span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>Descuento Aplicado:</span>
                <span className="font-mono tabular-nums">
                  -{dualDiscount.usd}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-foreground font-medium uppercase">
                TOTAL A PAGAR:
              </span>
              <div className="text-right">
                <span className="text-foreground font-mono text-base font-black tabular-nums">
                  {dualTotal.usd}
                </span>
                <div className="text-primary font-mono text-xs font-medium tabular-nums">
                  {dualTotal.bs}
                </div>
              </div>
            </div>
          </div>

          <div className="border-border/60 my-3 border-t border-dashed" />

          {/* Payments Breakdown */}
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground block font-medium uppercase">
              Formas de Pago:
            </span>
            {receipt.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between font-mono">
                <span className="text-muted-foreground">
                  {METHOD_LABELS[p.method] ?? p.method}
                  {p.reference ? ` (Ref: ${p.reference})` : ""}:
                </span>
                <span className="text-foreground font-medium tabular-nums">
                  {p.currency === "VES"
                    ? `Bs ${p.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                    : `$${p.amount.toFixed(2)}`}
                </span>
              </div>
            ))}

            {receipt.changeUsd > 0.001 && (
              <div className="flex justify-between pt-1 font-mono text-emerald-600 dark:text-emerald-400">
                <span className="font-medium">Vuelto / Cambio:</span>
                <span className="font-medium tabular-nums">
                  ${receipt.changeUsd.toFixed(2)} (Bs{" "}
                  {receipt.changeBs.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                  })}
                  )
                </span>
              </div>
            )}
          </div>

          {/* Slip Footer */}
          <div className="border-border/60 my-3 border-t border-dashed" />
          <div className="space-y-0.5 text-center">
            <p className="text-foreground text-xs font-medium">
              ¡Gracias por su preferencia!
            </p>
            <p className="text-muted-foreground text-[10px]">
              Comprobante no fiscal para control interno y despacho
            </p>
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="min-h-11 flex-1"
          >
            <Icons.Receipt className="size-4" />
            Imprimir Ticket
          </Button>

          <Button
            type="button"
            onClick={handleFinish}
            className="min-h-11 flex-1 font-medium"
          >
            <Icons.Add className="size-4" />
            Nueva Venta (POS)
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
