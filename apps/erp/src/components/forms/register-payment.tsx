"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Dialog, Field, FormActions, Input, Select } from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultOrderId?: string;
}

const PAYMENT_METHODS: {
  value: "mobile_payment" | "transfer" | "cash" | "pos_terminal" | "zelle";
  label: string;
}[] = [
  { value: "mobile_payment", label: "Pago Móvil" },
  { value: "transfer", label: "Transferencia Bancaria" },
  { value: "cash", label: "Efectivo" },
  { value: "pos_terminal", label: "Punto de Venta (POS)" },
  { value: "zelle", label: "Zelle" },
];

export function RegisterPaymentDialog({
  open,
  onClose,
  defaultOrderId,
}: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const { data: ordersData } = useQuery(
    trpc.sales.listOrders.queryOptions({ limit: 100 }),
  );

  const orders = useMemo(() => ordersData ?? [], [ordersData]);

  const [orderId, setOrderId] = useState(defaultOrderId ?? "");
  const [method, setMethod] = useState<
    "mobile_payment" | "transfer" | "cash" | "pos_terminal" | "zelle"
  >("mobile_payment");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerIdDoc, setPayerIdDoc] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setOrderId(defaultOrderId ?? "");
      setMethod("mobile_payment");
      setAmount("");
      setReference("");
      setBankName("");
      setPayerName("");
      setPayerIdDoc("");
      setNotes("");
    }
  }, [open, defaultOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === orderId) ?? null,
    [orders, orderId],
  );

  const pendingBalance = useMemo(() => {
    if (!selectedOrder) return 0;
    const total = Number(selectedOrder.total);
    const paid = Number(selectedOrder.totalPaid ?? 0);
    return Math.max(0, total - paid);
  }, [selectedOrder]);

  const handleOrderChange = (newOrderId: string) => {
    setOrderId(newOrderId);
    const found = orders.find((o) => o.id === newOrderId);
    if (found) {
      const balance = Math.max(
        0,
        Number(found.total) - Number(found.totalPaid ?? 0),
      );
      if (balance > 0) {
        setAmount(balance.toFixed(2));
      }
    }
  };

  const create = useMutation(
    trpc.sales.addPayment.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["payments"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
        onClose();
      },
    }),
  );

  const parsedAmount = parseFloat(amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || parsedAmount <= 0) return;

    create.mutate({
      orderId,
      method,
      amount: parsedAmount,
      reference: reference.trim() || undefined,
      bankName: bankName.trim() || undefined,
      payerName: payerName.trim() || undefined,
      payerIdDoc: payerIdDoc.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar Pago"
      description="Registra un cobro comercial vinculado a una orden de venta."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Orden de Venta" required>
          <Select
            value={orderId}
            onChange={(e) => handleOrderChange(e.target.value)}
          >
            <option value="">Selecciona una orden de venta...</option>
            {orders.map((o) => {
              const bal = Math.max(
                0,
                Number(o.total) - Number(o.totalPaid ?? 0),
              );
              return (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — Total: ${Number(o.total).toFixed(2)}
                  {bal > 0 ? ` (Resta: $${bal.toFixed(2)})` : " (Pagada)"}
                </option>
              );
            })}
          </Select>
        </Field>

        {selectedOrder && (
          <div className="border-border-subtle surface-card rounded-lg border p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Orden:</span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${Number(selectedOrder.total).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ya Pagado:</span>
              <span className="text-foreground font-mono tabular-nums">
                ${Number(selectedOrder.totalPaid ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="border-border-subtle mt-1.5 flex items-center justify-between border-t pt-1.5 text-xs">
              <span className="text-foreground font-medium">
                Saldo Pendiente:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-primary font-mono font-medium tabular-nums">
                  ${pendingBalance.toFixed(2)}
                </span>
                {pendingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(pendingBalance.toFixed(2))}
                    className="border-border-subtle hover:bg-accent text-primary rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                  >
                    Usar saldo total
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Método de Pago" required>
            <Select
              value={method}
              onChange={(e) =>
                setMethod(
                  e.target.value as
                    | "mobile_payment"
                    | "transfer"
                    | "cash"
                    | "pos_terminal"
                    | "zelle",
                )
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Monto a Cobrar ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono tabular-nums"
            />
          </Field>
        </div>

        {/* Currency preview */}
        {parsedAmount > 0 && bcv.rate > 0 && (
          <div className="border-border-subtle surface-card flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Equivalente BCV:</span>
            <span className="text-primary font-mono font-medium tabular-nums">
              {formatDualCurrency(parsedAmount, bcv.rate).bs}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Referencia / Nro. Voucher">
            <Input
              type="text"
              placeholder="Ej. 12345678"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="font-mono tabular-nums"
            />
          </Field>

          <Field label="Banco Emisor / Receptor">
            <Input
              type="text"
              placeholder="Ej. Banesco, Mercantil..."
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre del Pagador">
            <Input
              type="text"
              placeholder="Titular de la cuenta"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
          </Field>

          <Field label="Cédula / RIF del Pagador">
            <Input
              type="text"
              placeholder="Ej. V-12345678"
              value={payerIdDoc}
              onChange={(e) => setPayerIdDoc(e.target.value)}
              className="font-mono"
            />
          </Field>
        </div>

        <Field label="Notas / Observaciones">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles sobre la conciliación o pago..."
            className="border-border-subtle bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border p-2.5 text-sm transition-colors outline-none focus:ring-2"
          />
        </Field>

        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Registrar Pago"
        />
      </form>
    </Dialog>
  );
}
