"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FiscalIdType } from "@cendaro/validators";
import {
  createCustomerSchema,
  CUSTOMER_TYPES,
  FISCAL_ID_TYPE_LABELS,
  FISCAL_ID_TYPES,
  fiscalIdTypeOf,
  normalizeFiscalId,
  updateCustomerSchema,
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
  /** Edit this customer instead of registering a new one. */
  customerId?: string | null;
  onCustomerCreated?: (customer: CreatedCustomerResult) => void;
  onCustomerUpdated?: (customer: CreatedCustomerResult) => void;
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

interface StoredCustomer {
  id: string;
  name: string;
  legalName: string | null;
  identification: string | null;
  address: string | null;
  customerType: string;
  phone: string | null;
  email: string | null;
  creditLimit: number | null;
  creditDays: number | null;
}

function isCustomerType(value: string): value is CustomerType {
  return (CUSTOMER_TYPES as readonly string[]).includes(value);
}

/** Form values for a stored customer; an invalid document starts blank. */
function formFromCustomer(customer: StoredCustomer): FormState {
  const idType = fiscalIdTypeOf(customer.identification);
  const credit = (value: number | null) =>
    value && value > 0 ? String(value) : "";
  return {
    name: customer.name,
    legalName: customer.legalName ?? "",
    idType: idType ?? "rif",
    identification: idType ? (customer.identification ?? "") : "",
    customerType: isCustomerType(customer.customerType)
      ? customer.customerType
      : "retail",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    creditLimit: credit(customer.creditLimit),
    creditDays: credit(customer.creditDays),
  };
}

function toResult(data: StoredCustomer): CreatedCustomerResult {
  return {
    id: data.id,
    name: data.name,
    legalName: data.legalName,
    identification: data.identification,
    address: data.address,
    phone: data.phone,
    email: data.email,
    customerType: data.customerType,
  };
}

/**
 * Create or edit a customer — captures the buyer data SENIAT requires on an
 * invoice (Providencias SNAT/2011/00071 and SNAT/2024/000102): nombre o razón
 * social, RIF (or cédula / passport for natural persons) and domicilio
 * fiscal. Validation is shared with the server (`createCustomerSchema`,
 * `updateCustomerSchema`).
 */
export function CreateCustomerDialog({
  open,
  onClose,
  customerId,
  onCustomerCreated,
  onCustomerUpdated,
}: Props) {
  const trpc = useTRPC();
  const isEdit = Boolean(customerId);

  const { data: stored, isLoading } = useQuery({
    ...trpc.sales.customerById.queryOptions({ id: customerId ?? "" }),
    enabled: open && isEdit,
  });

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Cliente" : "Nuevo Cliente"}
      description="Registra al cliente con los datos que exige el SENIAT para su factura."
    >
      {isEdit && !stored ? (
        <SheetBody>
          <p className="text-muted-foreground text-sm">
            {isLoading ? "Cargando cliente…" : "Cliente no encontrado."}
          </p>
        </SheetBody>
      ) : (
        <CustomerForm
          // Remount per customer so the form starts from its stored values.
          key={isEdit ? (stored?.id ?? "edit") : "new"}
          stored={isEdit ? (stored ?? null) : null}
          onClose={onClose}
          onCustomerCreated={onCustomerCreated}
          onCustomerUpdated={onCustomerUpdated}
        />
      )}
    </SheetModal>
  );
}

interface CustomerFormProps {
  stored: StoredCustomer | null;
  onClose: () => void;
  onCustomerCreated?: (customer: CreatedCustomerResult) => void;
  onCustomerUpdated?: (customer: CreatedCustomerResult) => void;
}

function CustomerForm({
  stored,
  onClose,
  onCustomerCreated,
  onCustomerUpdated,
}: CustomerFormProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    stored ? formFromCustomer(stored) : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const finish = () => {
    void qc.invalidateQueries({ queryKey: [["sales"]] });
    if (!stored) setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  const create = useMutation(
    trpc.sales.createCustomer.mutationOptions({
      onSuccess: (data) => {
        if (data) onCustomerCreated?.(toResult(data));
        finish();
      },
    }),
  );
  const update = useMutation(
    trpc.sales.updateCustomer.mutationOptions({
      onSuccess: (data) => {
        if (data) onCustomerUpdated?.(toResult(data));
        finish();
      },
    }),
  );
  const mutationError = create.error ?? update.error;

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const idPreview = form.identification.trim()
    ? normalizeFiscalId(form.idType, form.identification)
    : null;
  const invalidStoredId =
    stored?.identification && fiscalIdTypeOf(stored.identification) === null
      ? stored.identification
      : null;

  const showErrors = (issues: { path: PropertyKey[]; message: string }[]) => {
    const next: FieldErrors = {};
    for (const issue of issues) {
      const key = issue.path[0] as keyof FormState | undefined;
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = {
      name: form.name,
      idType: form.idType,
      identification: form.identification,
      address: form.address,
      customerType: form.customerType,
    };

    if (stored) {
      // Blank optional fields clear the stored value; blank credit means none.
      const parsed = updateCustomerSchema.safeParse({
        ...fields,
        id: stored.id,
        legalName: form.legalName,
        phone: form.phone,
        email: form.email,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : 0,
        creditDays: form.creditDays ? parseInt(form.creditDays, 10) : 0,
      });
      if (!parsed.success) {
        showErrors(parsed.error.issues);
        return;
      }
      update.mutate(parsed.data);
      return;
    }

    const parsed = createCustomerSchema.safeParse({
      ...fields,
      legalName: form.legalName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      creditDays: form.creditDays ? parseInt(form.creditDays, 10) : undefined,
    });
    if (!parsed.success) {
      showErrors(parsed.error.issues);
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
      <SheetBody>
        {invalidStoredId && (
          <p
            role="status"
            className="bg-status-warning-bg text-status-warning-fg px-3 py-2 text-xs"
          >
            El documento registrado ({invalidStoredId}) no es un RIF, cédula o
            pasaporte válido. Ingresa el documento real del cliente.
          </p>
        )}

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

        {mutationError && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive border p-3 text-sm">
            {mutationError.message}
          </div>
        )}
      </SheetBody>

      <SheetFooter>
        <SheetFormActions
          onCancel={onClose}
          submitting={create.isPending || update.isPending}
          submitLabel={stored ? "Guardar Cambios" : "Crear Cliente"}
        />
      </SheetFooter>
    </form>
  );
}

export const CreateCustomerSheet = CreateCustomerDialog;
