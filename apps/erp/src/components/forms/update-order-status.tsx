"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Dialog } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

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
  const [status, setStatus] = useState(currentStatus);

  const update = useMutation(
    trpc.sales.updateOrderStatus.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        onClose();
      },
    }),
  );

  const statuses = [
    { value: "pending", label: "Pendiente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "prepared", label: "Preparado" },
    { value: "dispatched", label: "Despachado" },
    { value: "delivered", label: "Entregado" },
    { value: "cancelled", label: "Anulado" },
    { value: "returned", label: "Devuelto" },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Cambiar Estado del Pedido">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            id: orderId,
            status: status as
              | "pending"
              | "confirmed"
              | "prepared"
              | "dispatched"
              | "delivered"
              | "cancelled"
              | "returned",
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nuevo Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={update.isPending || status === currentStatus}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
        >
          {update.isPending ? "Actualizando..." : "Cambiar Estado"}
        </button>
      </form>
    </Dialog>
  );
}
