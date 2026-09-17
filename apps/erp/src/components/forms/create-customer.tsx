"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FiscalIdType } from "@cendaro/validators";
import {
  createCustomerSchema,
  CUSTOMER_TYPES,
  FISCAL_ID_TYPE_LABELS,
  FISCAL_ID_TYPES,
  normalizeFiscalId,
} from "@cendaro/validators";

import { Field, Input, Select } from "~/components/dialog";
import { Can } from "~/components/role-guard";
import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { useTRPC } from "~/trpc/client";

export interface CreatedCustomerResult {
  id: string;
  name: string;
  legalName?: string | null;
  identification?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  customerType?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: CreatedCustomerResult) => void;
}

type CustomerType = (typeof CUSTOMER_TYPES)[number];

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  retail: "Detal",
  wholesale: "Mayor",
  distributor: "Distribuidor",
  vip: "VIP",
  marketplace: "Marketplace",
  vendor_client: "Cliente Vendedor",
};

const ID_PLACEHOLDERS: Record<FiscalIdType, string> = {
  rif: "J-12345678-9",
  cedula: "V-12345678",
  pasaporte: "AB1234567",
};

const EMPTY_FORM = {
  name: "",
  legalName: "",
  idType: "rif" as FiscalIdType,
  identification: "",
  customerType: "retail" as CustomerType,
  phone: "",
  email: "",
  address: "",
  creditLimit: "",
  creditDays: "",
};

type FormState = typeof EMPTY_FORM;
type FieldErrors = Partial<Record<keyof FormState, string>>;

/**
 * Create customer — captures the buyer data SENIAT requires on an invoice
 * (Providencias SNAT/2011/00071 and SNAT/2024/000102): nombre o razón social,
 * RIF (or cédula / passport for natural persons) and domicilio fiscal.
 * Validation is shared with the server (`createCustomerSchema`).
 */
export function CreateCustomerDialog({
  open,
  onClose,
  onCustomerCreated,
}: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  const create = useMutation(
    trpc.sales.createCustomer.mutationOptions({
      onSuccess: (data) => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        if (data) {
          onCustomerCreated?.({
            id: data.id,
            name: data.name,
            legalName: data.legalName,
            identification: data.identification,
            address: data.address,
            phone: data.phone,
            email: data.email,
            customerType: data.customerType,
          });
        }
        setForm(EMPTY_FORM);
        setErrors({});
        onClose();
      },
    }),
  );

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const idPreview = form.identification.trim()
    ? normalizeFiscalId(form.idType, form.identification)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createCustomerSchema.safeParse({
      name: form.name,
      legalName: form.legalName || undefined,
      idType: form.idType,
      identification: form.identification,
      address: form.address,
      customerType: form.customerType,
      phone: form.phone || undefined,
      email: form.email || undefined,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      creditDays: form.creditDays ? parseInt(form.creditDays, 10) : undefined,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    create.mutate(parsed.data);
  };

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Nuevo Cliente"
      description="Registra al cliente con los datos que exige el SENIAT para su factura."
    >
      <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
        <SheetBody>
          <Field
            label="Nombre y apellido / Razón social"
            required
            error={errors.name}
          >
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Inversiones Miranda C.A."
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de documento" required>
              <Select
                value={form.idType}
                onChange={(e) => set("idType", e.target.value)}
              >
                {FISCAL_ID_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FISCAL_ID_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Número de documento"
              required
              error={errors.identification}
              hint={
                idPreview?.ok
                  ? `Se registrará como ${idPreview.value}`
                  : form.idType === "rif"
                    ? "Incluye el dígito verificador"
                    : "Persona natural sin RIF"
              }
            >
              <Input
                value={form.identification}
                onChange={(e) => set("identification", e.target.value)}
                onBlur={() => {
                  if (idPreview && !idPreview.ok) {
                    setErrors((prev) => ({
                      ...prev,
                      identification: idPreview.message,
                    }));
                  }
                }}
                placeholder={ID_PLACEHOLDERS[form.idType]}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field
            label="Domicilio fiscal"
            required
            error={errors.address}
            hint="Dirección completa tal como debe aparecer en la factura"
          >
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Av. Urdaneta, Edif. Centro, Piso 2, Caracas, Distrito Capital"
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre legal" error={errors.legalName}>
              <Input
                value={form.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                placeholder="Si difiere del nombre comercial"
              />
            </Field>
            <Field label="Tipo de Cliente">
              <Select
                value={form.customerType}
                onChange={(e) => set("customerType", e.target.value)}
              >
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CUSTOMER_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+58 412 1234567"
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </Field>
          </div>

          <Can module="customers" action="approve">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Límite de Crédito ($)"
                hint="Dejar vacío = sin crédito"
                error={errors.creditLimit}
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) => set("creditLimit", e.target.value)}
                  placeholder="5000"
                />
              </Field>
              <Field
                label="Días de Crédito"
                hint="Plazo en días"
                error={errors.creditDays}
              >
                <Input
                  type="number"
                  min="0"
                  value={form.creditDays}
                  onChange={(e) => set("creditDays", e.target.value)}
                  placeholder="30"
                />
              </Field>
            </div>
          </Can>

          {create.error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive border p-3 text-sm">
              {create.error.message}
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={create.isPending}
            submitLabel="Crear Cliente"
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const CreateCustomerSheet = CreateCustomerDialog;
