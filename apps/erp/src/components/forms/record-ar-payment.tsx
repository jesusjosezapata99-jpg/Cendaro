"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  Field,
  FormActions,
  Input,
  TextArea,
} from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface ReceivableItem {
  id: string;
  balance: number;
  totalAmount?: number;
  customerName?: string;
  orderId?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  receivable: ReceivableItem | null;
}

export function RecordArPaymentDialog({ open, onClose, receivable }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && receivable) {
      setAmount("");
      setReference("");
      setNotes("");
    }
  }, [open, receivable]);

  const record = useMutation(
    trpc.vendor.recordPayment.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["vendor"]] });
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
        onClose();
      },
    }),
  );

  if (!receivable) return null;

  const currentBalance = Number(receivable.balance);
  const parsedAmount = parseFloat(amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivable.id || parsedAmount <= 0) return;

    const fullNotes = [
      reference.trim() ? `Ref: ${reference.trim()}` : null,
      notes.trim() ? notes.trim() : null,
    ]
      .filter(Boolean)
      .join(" | ");

    record.mutate({
      id: receivable.id,
      amount: parsedAmount,
      notes: fullNotes || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar Abono a Cuenta"
      description={`Abono de cobranza comercial para ${receivable.customerName ?? "la cuenta seleccionada"}.`}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Balance Card */}
        <div className="border-border-subtle surface-card rounded-lg border p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Saldo Pendiente:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              ${currentBalance.toFixed(2)}
            </span>
          </div>
          {bcv.rate > 0 && currentBalance > 0 && (
            <div className="text-muted-foreground flex items-center justify-between text-[11px]">
              <span>Equivalente Oficial:</span>
              <span className="font-mono tabular-nums">
                {formatDualCurrency(currentBalance, bcv.rate).bs}
              </span>
            </div>
          )}
          {currentBalance > 0 && (
            <div className="border-border-subtle mt-2 flex justify-end border-t pt-1.5">
              <button
                type="button"
                onClick={() => setAmount(currentBalance.toFixed(2))}
                className="border-border-subtle hover:bg-accent text-primary rounded border px-2 py-0.5 text-xs font-medium transition-colors"
              >
                Abonar saldo total (${currentBalance.toFixed(2)})
              </button>
            </div>
          )}
        </div>

        <Field label="Monto a Abonar ($)" required>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={currentBalance > 0 ? currentBalance : undefined}
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono tabular-nums"
          />
        </Field>

        {parsedAmount > 0 && bcv.rate > 0 && (
          <div className="border-border-subtle surface-card flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Conversión BCV:</span>
            <span className="text-primary font-mono font-medium tabular-nums">
              {formatDualCurrency(parsedAmount, bcv.rate).bs}
            </span>
          </div>
        )}

        <Field label="Referencia / Nro. Comprobante">
          <Input
            type="text"
            placeholder="Ej. Transferencia 987654"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="font-mono"
          />
        </Field>

        <Field label="Notas / Observaciones del Abono">
          <TextArea
            rows={2}
            placeholder="Detalles sobre el pago o acuerdo de cobranza..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <FormActions
          onCancel={onClose}
          submitting={record.isPending}
          submitLabel="Registrar Abono"
        />
      </form>
    </Dialog>
  );
}
