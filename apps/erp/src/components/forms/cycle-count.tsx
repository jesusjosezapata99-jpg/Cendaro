"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Field, Input, Select, FormActions, TextArea } from "~/components/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CycleCountDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: warehouses } = useQuery(trpc.inventory.listWarehouses.queryOptions());

  const create = useMutation(
    trpc.inventory.createCount.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
        onClose();
      },
    }),
  );

  const [form, setForm] = useState({
    warehouseId: "",
    scheduledAt: "",
    notes: "",
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      warehouseId: form.warehouseId,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nuevo Conteo Cíclico" description="Programa un conteo de inventario en un almacén.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Almacén" required>
          <Select value={form.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} required>
            <option value="">Seleccionar almacén...</option>
            {(warehouses ?? []).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Fecha Programada" hint="Dejar vacío para conteo inmediato">
          <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
        </Field>

        <Field label="Notas">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Observaciones del conteo..." />
        </Field>

        {create.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {create.error.message}
          </div>
        )}

        <FormActions onCancel={onClose} submitting={create.isPending} submitLabel="Crear Conteo" />
      </form>
    </Dialog>
  );
}
