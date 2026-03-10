"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Dialog } from "~/components/dialog";
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
    <Dialog open={open} onClose={onClose} title="Nuevo Proveedor">
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
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">País</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
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
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            type="email"
            placeholder="email@proveedor.com"
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={create.isPending || !name}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
        >
          {create.isPending ? "Creando..." : "Crear Proveedor"}
        </button>
      </form>
    </Dialog>
  );
}
