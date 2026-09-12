"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Dialog } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

/** Manual transition targets. `draft` / `pending_confirmation` are entry states set by the system. */
const TRANSITIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "prepared", label: "Preparado" },
  { value: "dispatched", label: "Despachado" },
  { value: "delivered", label: "Entregado" },
  { value: "invoiced", label: "Facturado" },
  { value: "cancelled", label: "Anulado" },
  { value: "returned", label: "Devuelto" },
] as const;

/** Entry-state labels, shown read-only while the order is still in one of them. */
const ENTRY_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending_confirmation: "Por Confirmar",
};

export function UpdateOrderStatusDialog({
  open,
  onClose,
  orderId,
  currentStatus,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  currentStatus: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const selectId = useId();
  const [status, setStatus] = useState(currentStatus);

  const update = useMutation(
    trpc.sales.updateOrderStatus.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        onClose();
      },
      onError: (err) => {
        toast.error(`Error al actualizar estado: ${err.message}`);
      },
    }),
  );

  const isEntryState = !TRANSITIONS.some((s) => s.value === currentStatus);

  return (
    <Dialog open={open} onClose={onClose} title="Cambiar Estado del Pedido">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const target = TRANSITIONS.find((s) => s.value === status);
          if (!target) return;
          update.mutate({ id: orderId, status: target.value });
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor={selectId}
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Nuevo Estado
          </label>
          <select
            id={selectId}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-border-subtle bg-background text-foreground focus:border-primary focus:ring-primary/20 min-h-11 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            {isEntryState && (
              <option value={currentStatus} disabled>
                {ENTRY_LABELS[currentStatus] ?? currentStatus} (actual)
              </option>
            )}
            {TRANSITIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border-subtle hover:bg-accent min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={update.isPending || status === currentStatus}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {update.isPending ? "Actualizando..." : "Cambiar Estado"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
