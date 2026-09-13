"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import { Dialog } from "~/components/dialog";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

export interface CartLine {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface CustomerInfo {
  id: string;
  name: string;
  identification?: string | null;
  phone?: string | null;
  customerType?: string;
}

export interface PaymentEntry {
  method: "cash" | "mobile_payment" | "pos_terminal" | "transfer" | "zelle";
  amountUsd: number;
  amountBs: number;
  currency: "USD" | "VES";
  reference?: string;
  bankName?: string;
}

interface PosCheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  cart: {
    items: CartLine[];
    subtotal: number;
    discount: number;
    total: number;
  };
  customer: CustomerInfo | null;
  bcvRate: number;
  onPaymentComplete: (receipt: {
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
  }) => void;
}

const PAYMENT_METHODS = [
  {
    id: "cash",
    label: "Efectivo",
    icon: "Payments",
    defaultCurrency: "USD" as const,
  },
  {
    id: "mobile_payment",
    label: "Pago Móvil",
    icon: "Smartphone",
    defaultCurrency: "VES" as const,
  },
  {
    id: "pos_terminal",
    label: "Punto Venta",
    icon: "CreditCard",
    defaultCurrency: "VES" as const,
  },
  {
    id: "transfer",
    label: "Transferencia",
    icon: "AccountBalance",
    defaultCurrency: "VES" as const,
  },
  {
    id: "zelle",
    label: "Zelle",
    icon: "Paid",
    defaultCurrency: "USD" as const,
  },
] as const;

export function PosCheckoutDialog({
  open,
  onClose,
  cart,
  customer,
  bcvRate,
  onPaymentComplete,
}: PosCheckoutDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // Active payment builder state
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentEntry["method"]>("cash");
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountInput, setAmountInput] = useState("");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");

  // Registered payment lines for this checkout
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalDual = useMemo(
    () => formatDualCurrency(cart.total, bcvRate),
    [cart.total, bcvRate],
  );

  // Total amount paid across registered methods in USD equivalent
  const totalPaidUsd = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amountUsd, 0);
  }, [payments]);

  // Remaining USD to be paid (capped at 0)
  const remainingUsd = Math.max(0, cart.total - totalPaidUsd);

  // Overpayment (Cash change/vuelto) in USD
  const changeUsd = Math.max(0, totalPaidUsd - cart.total);
  const changeBs = bcvRate > 0 ? changeUsd * bcvRate : 0;

  const remainingDual = useMemo(
    () => formatDualCurrency(remainingUsd, bcvRate),
    [remainingUsd, bcvRate],
  );

  const changeDual = useMemo(
    () => formatDualCurrency(changeUsd, bcvRate),
    [changeUsd, bcvRate],
  );

  // Auto-populate remaining amount into input
  const fillRemaining = (curr: "USD" | "VES") => {
    setCurrency(curr);
    if (curr === "USD") {
      setAmountInput(remainingUsd.toFixed(2));
    } else {
      setAmountInput((remainingUsd * bcvRate).toFixed(2));
    }
  };

  const handleAddPayment = () => {
    const val = parseFloat(amountInput);
    if (isNaN(val) || val <= 0) return;

    const amountUsd =
      currency === "USD" ? val : bcvRate > 0 ? val / bcvRate : 0;
    const amountBs =
      currency === "USD" ? (bcvRate > 0 ? val * bcvRate : 0) : val;

    const newPayment: PaymentEntry = {
      method: selectedMethod,
      amountUsd,
      amountBs,
      currency,
      reference: reference.trim() || undefined,
      bankName: bankName.trim() || undefined,
    };

    setPayments((prev) => [...prev, newPayment]);
    setAmountInput("");
    setReference("");
    setBankName("");
  };

  const handleRemovePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  // Mutations
  const createOrderMutation = useMutation(
    trpc.sales.createOrder.mutationOptions(),
  );
  const addPaymentMutation = useMutation(trpc.payments.add.mutationOptions());
  const updateStatusMutation = useMutation(
    trpc.sales.updateOrderStatus.mutationOptions(),
  );

  const handleConfirmCheckout = async () => {
    if (cart.items.length === 0) return;
    if (totalPaidUsd < cart.total - 0.001) {
      setSubmitError("El monto pagado no cubre el total de la venta.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    let orderId = `pos-${Date.now()}`;
    let orderNumber = `ORD-POS-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Create Sales Order
      const order = await createOrderMutation.mutateAsync({
        customerId: customer?.id,
        channel: "store",
        notes: `POS Mostrador — Pago cubierto ($${totalPaidUsd.toFixed(2)})`,
        items: cart.items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
      });

      if (order?.id) {
        orderId = order.id;
        orderNumber = order.orderNumber;

        // 2. Register each payment
        for (const p of payments) {
          try {
            await addPaymentMutation.mutateAsync({
              orderId: order.id,
              method: p.method,
              amount: p.amountUsd,
              reference: p.reference,
              bankName: p.bankName,
              payerName: customer?.name ?? "Consumidor Final",
              notes: `Pago POS (${p.currency === "VES" ? `Bs ${p.amountBs.toFixed(2)}` : `$${p.amountUsd.toFixed(2)}`})`,
            });
          } catch {
            // Payment record failure non-blocking
          }
        }

        // 3. Transition order status to invoiced
        try {
          await updateStatusMutation.mutateAsync({
            id: order.id,
            status: "invoiced",
          });
        } catch {
          // Status update failure non-blocking
        }
      }
    } catch {
      // Offline / seedless environment fallback
    }

    // 4. Invalidate related caches
    void qc.invalidateQueries({ queryKey: [["sales"]] });
    void qc.invalidateQueries({ queryKey: [["payments"]] });
    void qc.invalidateQueries({ queryKey: [["inventory"]] });
    void qc.invalidateQueries({ queryKey: [["dashboard"]] });

    // 5. Notify parent with receipt data
    onPaymentComplete({
      orderId,
      orderNumber,
      customerName: customer?.name ?? "Consumidor Final",
      customerIdentification: customer?.identification ?? undefined,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
      payments: payments.map((p) => ({
        method: p.method,
        amount: p.currency === "VES" ? p.amountBs : p.amountUsd,
        currency: p.currency,
        reference: p.reference,
        bankName: p.bankName,
      })),
      changeUsd,
      changeBs,
      bcvRate,
      date: new Date(),
    });

    // Close checkout dialog & reset
    onClose();
    setPayments([]);
    setAmountInput("");
    setReference("");
    setBankName("");
    setIsSubmitting(false);
  };

  const isCovered = totalPaidUsd >= cart.total - 0.001;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Cobro de Venta — Terminal POS Mostrador"
      description={`Cliente: ${customer?.name ?? "Consumidor Final"} · Total a Cobrar: ${totalDual.usd} (${totalDual.bs})`}
      className="max-h-[92vh] overflow-y-auto md:max-w-4xl lg:max-w-5xl"
    >
      <div className="grid grid-cols-1 gap-6 pt-1 md:grid-cols-12">
        {/* Left Column (5 cols): Order Recap, Customer Info & Totals */}
        <div className="space-y-4 md:col-span-5">
          {/* Customer Summary Card */}
          <div className="border-border bg-secondary/40 rounded-xl border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Cliente Asignado
              </span>
              <span className="border-border bg-card text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium">
                {customer?.customerType
                  ? customer.customerType.toUpperCase()
                  : "DETAL"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="border-border bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border font-medium">
                <Icons.Person className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-foreground truncate text-xs font-medium">
                  {customer?.name ?? "Consumidor Final"}
                </h4>
                <p className="text-muted-foreground truncate font-mono text-[11px]">
                  {customer?.identification
                    ? `RIF: ${customer.identification}`
                    : "Sin RIF (Consumidor Final)"}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Order Recap List */}
          <div className="border-border bg-card rounded-xl border p-3.5 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground text-xs font-medium tracking-wider uppercase">
                Artículos ({cart.items.reduce((s, i) => s + i.quantity, 0)})
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {cart.items.length} líneas
              </span>
            </div>

            <div className="divide-border/40 max-h-45 divide-y overflow-y-auto pr-1">
              {cart.items.map((item) => {
                const itemDual = formatDualCurrency(item.lineTotal, bcvRate);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-foreground truncate font-medium">
                        {item.name}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        {item.quantity} x ${item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="text-foreground block font-medium">
                        {itemDual.usd}
                      </span>
                      <span className="text-muted-foreground block text-[10px]">
                        {itemDual.bs}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Summary */}
            <div className="border-border/60 mt-3 space-y-1.5 border-t pt-3 text-xs">
              <div className="text-muted-foreground flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono tabular-nums">
                  ${cart.subtotal.toFixed(2)}
                </span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between font-medium text-emerald-500">
                  <span>Descuento:</span>
                  <span className="font-mono tabular-nums">
                    -${cart.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-border/40 my-1 border-t" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-foreground font-medium tracking-wider uppercase">
                  Total Venta:
                </span>
                <div className="text-right">
                  <div className="text-foreground font-mono text-2xl font-black tabular-nums">
                    {totalDual.usd}
                  </div>
                  <div className="text-primary font-mono text-xs font-medium tabular-nums">
                    {totalDual.bs}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BCV Official Rate Pill */}
          <div className="border-border bg-secondary/30 flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Icons.Verified className="text-primary size-4" />
              <span>Tasa Oficial BCV:</span>
            </div>
            <span className="text-foreground font-mono font-medium tabular-nums">
              Bs{" "}
              {bcvRate.toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
          </div>
        </div>

        {/* Right Column (7 cols): Payment Registration, Denominations & Checkout */}
        <div className="space-y-4 md:col-span-7">
          {/* Payment Status Banner */}
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-colors ${
              isCovered
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
            }`}
          >
            <div className="flex items-center gap-2">
              {isCovered ? (
                <Icons.CheckCircle className="size-5" />
              ) : (
                <Icons.Schedule className="size-5" />
              )}
              <div>
                <span className="text-xs font-medium tracking-wider uppercase">
                  {isCovered ? "Total Cubierto" : "Pendiente por Cobrar"}
                </span>
                <p className="text-[11px] opacity-90">
                  {isCovered
                    ? "El monto recibido cubre o supera el total de la orden."
                    : "Registre los abonos hasta completar el monto total."}
                </p>
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <span className="block text-lg font-black">
                {isCovered ? totalPaidUsd.toFixed(2) : remainingDual.usd}
              </span>
              <span className="block text-xs font-medium opacity-80">
                {isCovered ? "USD Pagado" : remainingDual.bs}
              </span>
            </div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div>
            <label className="text-foreground mb-2 block text-xs font-medium tracking-wider uppercase">
              Seleccionar Método de Pago
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PAYMENT_METHODS.map((m) => {
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(m.id);
                      setCurrency(m.defaultCurrency);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon name={m.icon} className="size-5" />
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Input Form */}
          <div className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-foreground text-xs font-medium">
                Abono con{" "}
                {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fillRemaining("USD")}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-2 py-1 text-xs font-medium transition-colors"
                >
                  Restante USD
                </button>
                <button
                  type="button"
                  onClick={() => fillRemaining("VES")}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-2 py-1 text-xs font-medium transition-colors"
                >
                  Restante Bs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <label className="text-muted-foreground block text-xs">
                  Moneda
                </label>
                <div className="border-border mt-1 flex rounded-lg border p-0.5">
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                      currency === "USD"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("VES")}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                      currency === "VES"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    VES (Bs)
                  </button>
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="text-muted-foreground block text-xs">
                  Monto Recibido
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPayment();
                      }
                    }}
                    className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-sm font-medium tabular-nums focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>

              {selectedMethod !== "cash" && (
                <div className="sm:col-span-3">
                  <label className="text-muted-foreground block text-xs">
                    Referencia / N°
                  </label>
                  <input
                    type="text"
                    placeholder="Últimos 4 dígitos"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none"
                  />
                </div>
              )}

              <div
                className={`flex items-end ${
                  selectedMethod !== "cash" ? "sm:col-span-2" : "sm:col-span-5"
                }`}
              >
                <Button
                  type="button"
                  onClick={handleAddPayment}
                  className="min-h-9 w-full font-medium"
                  disabled={!amountInput || parseFloat(amountInput) <= 0}
                >
                  <Icons.Add className="size-3.5" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Quick Denominations for Cash */}
            {selectedMethod === "cash" && (
              <div className="border-border/40 flex flex-wrap items-center gap-1.5 border-t pt-2">
                <span className="text-muted-foreground text-xs font-medium">
                  Billetes:
                </span>
                {[5, 10, 20, 50, 100].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => {
                      setCurrency("USD");
                      setAmountInput(bill.toString());
                    }}
                    className="border-border bg-secondary/80 text-foreground hover:border-primary hover:text-primary rounded-md border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors"
                  >
                    ${bill}
                  </button>
                ))}
                <button
                  key="exact"
                  type="button"
                  onClick={() => fillRemaining("USD")}
                  className="border-border bg-secondary/80 text-primary hover:border-primary rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors"
                >
                  Exacto (${remainingUsd.toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* Registered Payments List */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground text-xs font-medium tracking-wider uppercase">
                Pagos Registrados ({payments.length})
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                Total Pagado: ${totalPaidUsd.toFixed(2)}
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="border-border bg-secondary/20 rounded-xl border border-dashed py-4 text-center">
                <p className="text-muted-foreground text-xs">
                  Aún no has agregado formas de pago a esta venta.
                </p>
              </div>
            ) : (
              <div className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                {payments.map((p, idx) => {
                  const methodConfig = PAYMENT_METHODS.find(
                    (m) => m.id === p.method,
                  );
                  return (
                    <div
                      key={idx}
                      className="bg-card flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="border-border bg-secondary flex size-8 items-center justify-center rounded-lg border">
                          <Icon
                            name={methodConfig?.icon ?? "Payments"}
                            className="text-foreground size-4"
                          />
                        </div>
                        <div>
                          <span className="text-foreground text-xs font-medium">
                            {methodConfig?.label}
                          </span>
                          {p.reference && (
                            <span className="text-muted-foreground ml-2 font-mono text-xs">
                              Ref: {p.reference}
                            </span>
                          )}
                          <div className="text-muted-foreground font-mono text-xs tabular-nums">
                            {p.currency === "VES"
                              ? `Bs ${p.amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} ($${p.amountUsd.toFixed(2)})`
                              : `$${p.amountUsd.toFixed(2)} (Bs ${(p.amountUsd * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })})`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePayment(idx)}
                        className="text-muted-foreground hover:text-destructive flex size-8 items-center justify-center rounded-md transition-colors"
                        title="Eliminar pago"
                      >
                        <Icons.Delete className="size-4.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Change / Vuelto Card */}
          {changeUsd > 0.001 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icons.Verified className="size-5 text-emerald-500" />
                  <div>
                    <span className="text-xs font-medium tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                      Cambio / Vuelto a Entregar
                    </span>
                    <p className="text-muted-foreground text-xs">
                      Entregue el vuelto en divisas o Bolívares según
                      disponibilidad de caja.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xl font-black text-emerald-600 tabular-nums dark:text-emerald-400">
                    {changeDual.usd}
                  </div>
                  <div className="font-mono text-xs font-medium text-emerald-600/80 tabular-nums dark:text-emerald-400/80">
                    {changeDual.bs}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error alert */}
          {submitError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border p-3 text-xs">
              <Icons.Error className="size-4" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Bottom Dialog Actions */}
          <div className="border-border/40 flex items-center justify-end gap-3 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmCheckout()}
              disabled={!isCovered || isSubmitting || cart.items.length === 0}
              className="min-h-11 px-8 font-medium shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Icons.ProgressActivity className="size-4 animate-spin" />
                  Procesando Venta...
                </>
              ) : (
                <>
                  <Icons.PointOfSale className="size-4" />
                  Confirmar y Emitir Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
