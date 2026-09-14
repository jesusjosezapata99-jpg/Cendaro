"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { useTRPC } from "~/trpc/client";

export function CreateSupplierDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("CN");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const create = useMutation(
    trpc.catalog.createSupplier.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        setName("");
        setContactName("");
        setContactEmail("");
        onClose();
      },
    }),
  );

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Nuevo Proveedor"
      description="Registra un nuevo proveedor en el catálogo."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            name,
            country,
            contactName: contactName || undefined,
            contactEmail: contactEmail || undefined,
          });
        }}
        className="flex h-full flex-col"
      >
        <SheetBody>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">País</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border-border bg-background w-full border px-3 py-2 text-sm"
            >
              <option value="CN">🇨🇳 China</option>
              <option value="US">🇺🇸 Estados Unidos</option>
              <option value="CO">🇨🇴 Colombia</option>
              <option value="VE">🇻🇪 Venezuela</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contacto</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre de contacto"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
              placeholder="email@proveedor.com"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={create.isPending}
            submitLabel="Crear Proveedor"
            disabled={!name}
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const CreateSupplierSheet = CreateSupplierDialog;
