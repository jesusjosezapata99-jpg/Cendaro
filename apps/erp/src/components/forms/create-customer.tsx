"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, Field, Input, Select, FormActions } from "~/components/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateCustomerDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const create = useMutation(
    trpc.sales.createCustomer.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [['sales']] });
        onClose();
      },
    }),
  );

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    identification: "",
    customerType: "retail" as "retail" | "wholesale" | "distributor" | "vip" | "marketplace" | "vendor_client",
    phone: "",
    email: "",
    address: "",
    creditLimit: "",
    creditDays: "",
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      name: form.name,
      legalName: form.legalName || undefined,
      identification: form.identification || undefined,
      customerType: form.customerType,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      creditDays: form.creditDays ? parseInt(form.creditDays, 10) : undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nuevo Cliente" description="Registra un nuevo cliente en el sistema.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre / Razón Social" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Inversiones Miranda C.A." required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre Legal">
            <Input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Nombre legal completo" />
          </Field>
          <Field label="RIF / Cédula">
            <Input value={form.identification} onChange={(e) => set("identification", e.target.value)} placeholder="J-12345678-0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de Cliente">
            <Select value={form.customerType} onChange={(e) => set("customerType", e.target.value)}>
              <option value="retail">Detal</option>
              <option value="wholesale">Mayor</option>
              <option value="distributor">Distribuidor</option>
              <option value="vip">VIP</option>
              <option value="marketplace">Marketplace</option>
              <option value="vendor_client">Cliente Vendedor</option>
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+58 412 1234567" />
          </Field>
        </div>

        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@ejemplo.com" />
        </Field>

        <Field label="Dirección">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Av. Principal, Caracas" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Límite de Crédito ($)" hint="Dejar vacío = sin crédito">
            <Input type="number" step="0.01" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} placeholder="5000" />
          </Field>
          <Field label="Días de Crédito" hint="Plazo en días">
            <Input type="number" value={form.creditDays} onChange={(e) => set("creditDays", e.target.value)} placeholder="30" />
          </Field>
        </div>

        {create.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {create.error.message}
          </div>
        )}

        <FormActions onCancel={onClose} submitting={create.isPending} submitLabel="Crear Cliente" />
      </form>
    </Dialog>
  );
}
