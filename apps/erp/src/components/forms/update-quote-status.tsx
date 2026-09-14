"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Dialog } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

export function UpdateQuoteStatusDialog({
  open,
  onClose,
  quoteId,
  currentStatus,
}: {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  currentStatus: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [status, setStatus] = useState(currentStatus);

  const update = useMutation(
    trpc.quotes.updateStatus.mutationOptions({
      onMutate: async (variables) => {
        await qc.cancelQueries({ queryKey: [["quotes"]] });
        const queryKey = trpc.quotes.byId.queryKey({ id: variables.id });
        const previousQuote = qc.getQueryData(queryKey);
        if (previousQuote) {
          qc.setQueryData(queryKey, (old) =>
            old ? { ...old, status: variables.status } : old,
          );
        }
        toast.success(`Estado de cotización actualizado a ${variables.status}`);
        onClose();
        return { previousQuote, queryKey };
      },
      onError: (err, _variables, context) => {
        if (context?.queryKey && context.previousQuote) {
          qc.setQueryData(context.queryKey, context.previousQuote);
        }
        toast.error(`Error al actualizar cotización: ${err.message}`);
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: [["quotes"]] });
      },
    }),
  );

  const statuses: {
    value: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
    label: string;
  }[] = [
    { value: "draft", label: "Borrador" },
    { value: "sent", label: "Enviada" },
    { value: "accepted", label: "Aceptada" },
    { value: "rejected", label: "Rechazada" },
    { value: "expired", label: "Expirada" },
    { value: "converted", label: "Convertida" },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Cambiar Estado de Cotización">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            id: quoteId,
            status: status as
              | "draft"
              | "sent"
              | "accepted"
              | "rejected"
              | "expired"
              | "converted",
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">
            Nuevo Estado
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-border-subtle bg-background text-foreground focus:border-primary focus:ring-primary/20 min-h-11 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            {statuses.map((s) => (
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
            className="border-border-subtle hover:bg-accent min-h-11 border px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {update.isPending ? "Guardando..." : "Actualizar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
