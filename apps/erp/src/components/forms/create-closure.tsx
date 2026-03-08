"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, Field, Input, TextArea, FormActions } from "~/components/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateClosureDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    closureDate: new Date().toISOString().split("T")[0] ?? "",
    totalSales: "",
    totalCash: "",
    totalDigital: "",
    expectedTotal: "",
    actualTotal: "",
    notes: "",
  });

  const create = useMutation(
    trpc.sales.createClosure.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
        setForm({ closureDate: new Date().toISOString().split("T")[0] ?? "", totalSales: "", totalCash: "", totalDigital: "", expectedTotal: "", actualTotal: "", notes: "" });
        onClose();
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      closureDate: new Date(form.closureDate).toISOString(),
      totalSales: parseFloat(form.totalSales) || 0,
      totalCash: parseFloat(form.totalCash) || 0,
      totalDigital: parseFloat(form.totalDigital) || 0,
      expectedTotal: parseFloat(form.expectedTotal) || 0,
      actualTotal: parseFloat(form.actualTotal) || 0,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Cerrar Día" description="Registra el cierre de caja del día" className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Fecha de Cierre" required>
          <Input
            type="date"
            required
            value={form.closureDate}
            onChange={(e) => setForm((f) => ({ ...f, closureDate: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Total Ventas" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalSales}
              onChange={(e) => setForm((f) => ({ ...f, totalSales: e.target.value }))}
            />
          </Field>
          <Field label="Total Efectivo" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalCash}
              onChange={(e) => setForm((f) => ({ ...f, totalCash: e.target.value }))}
            />
          </Field>
          <Field label="Total Digital" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalDigital}
              onChange={(e) => setForm((f) => ({ ...f, totalDigital: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total Esperado" required hint="Suma automática del sistema">
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.expectedTotal}
              onChange={(e) => setForm((f) => ({ ...f, expectedTotal: e.target.value }))}
            />
          </Field>
          <Field label="Total Real" required hint="Conteo físico de caja">
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.actualTotal}
              onChange={(e) => setForm((f) => ({ ...f, actualTotal: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Notas">
          <TextArea
            rows={2}
            placeholder="Observaciones del cierre..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>
        <FormActions onCancel={onClose} submitting={create.isPending} submitLabel="Registrar Cierre" />
      </form>
    </Dialog>
  );
}
