"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  Field,
  FormActions,
  Input,
  TextArea,
} from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateContainerDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    containerNumber: "",
    departureDate: "",
    arrivalDate: "",
    costFob: "",
    notes: "",
  });

  const create = useMutation(
    trpc.container.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["container"]] });
        setForm({
          containerNumber: "",
          departureDate: "",
          arrivalDate: "",
          costFob: "",
          notes: "",
        });
        onClose();
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      containerNumber: form.containerNumber,
      departureDate: form.departureDate
        ? new Date(form.departureDate).toISOString()
        : undefined,
      arrivalDate: form.arrivalDate
        ? new Date(form.arrivalDate).toISOString()
        : undefined,
      costFob: form.costFob ? parseFloat(form.costFob) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo Contenedor"
      description="Registra un nuevo contenedor de importación"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Número de Contenedor" required>
          <Input
            required
            placeholder="MSKU-1234567"
            value={form.containerNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, containerNumber: e.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de Salida">
            <Input
              type="date"
              value={form.departureDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, departureDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Fecha de Llegada">
            <Input
              type="date"
              value={form.arrivalDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, arrivalDate: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field
          label="Costo FOB (USD)"
          hint="Costo total del contenedor en dólares"
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.costFob}
            onChange={(e) =>
              setForm((f) => ({ ...f, costFob: e.target.value }))
            }
          />
        </Field>
        <Field label="Notas">
          <TextArea
            rows={3}
            placeholder="Observaciones sobre el contenedor..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>
        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Crear Contenedor"
        />
      </form>
    </Dialog>
  );
}
