"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  TextArea,
} from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultCustomerId?: string;
  defaultOrderId?: string;
}

export function CreateArDialog({
  open,
  onClose,
  defaultCustomerId,
  defaultOrderId,
}: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );
  const { data: ordersData } = useQuery(
    trpc.sales.listOrders.queryOptions({ limit: 100 }),
  );

  const customers = useMemo(() => customersData ?? [], [customersData]);
  const orders = useMemo(() => ordersData ?? [], [ordersData]);

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0] ?? "";
  }, []);

  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [orderId, setOrderId] = useState(defaultOrderId ?? "");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? "");
      setOrderId(defaultOrderId ?? "");
      setTotalAmount("");
      setDueDate(defaultDueDate);
      setNotes("");
    }
  }, [open, defaultCustomerId, defaultOrderId, defaultDueDate]);

  const create = useMutation(
    trpc.vendor.createAR.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["vendor"]] });
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
        onClose();
      },
    }),
  );

  const parsedAmount = parseFloat(totalAmount) || 0;

  // If order selected, suggest remaining order balance
  const handleOrderChange = (selectedOrderId: string) => {
    setOrderId(selectedOrderId);
    if (!selectedOrderId) return;
    const found = orders.find((o) => o.id === selectedOrderId);
    if (found) {
      if (found.customerId && !customerId) {
        setCustomerId(found.customerId);
      }
      const bal = Math.max(
        0,
        Number(found.total) - Number(found.totalPaid ?? 0),
      );
      if (bal > 0) {
        setTotalAmount(bal.toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || parsedAmount <= 0 || !dueDate) return;

    create.mutate({
      customerId,
      orderId: orderId ? orderId : undefined,
      totalAmount: parsedAmount,
      dueDate: new Date(`${dueDate}T12:00:00.000Z`).toISOString(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva Cuenta por Cobrar"
      description="Apertura de línea o cuenta por cobrar comercial a cliente."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Cliente" required>
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">Seleccionar cliente...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Orden de Venta (Opcional)">
          <Select
            value={orderId}
            onChange={(e) => handleOrderChange(e.target.value)}
          >
            <option value="">Sin orden vinculada</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — Total: ${Number(o.total).toFixed(2)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monto a Crédito ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="font-mono tabular-nums"
            />
          </Field>

          <Field label="Fecha de Vencimiento" required>
            <Input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>

        {parsedAmount > 0 && bcv.rate > 0 && (
          <div className="border-border-subtle surface-card flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Equivalente BCV:</span>
            <span className="text-primary font-mono font-semibold tabular-nums">
              {formatDualCurrency(parsedAmount, bcv.rate).bs}
            </span>
          </div>
        )}

        <Field label="Términos / Notas de Crédito">
          <TextArea
            rows={2}
            placeholder="Condiciones acordadas, días de gracia o detalles..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Crear Cuenta"
        />
      </form>
    </Dialog>
  );
}
