"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "~/components/dialog";

export function CreateSupplierDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        setName(""); setContactName(""); setContactEmail("");
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
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">País</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="CN">🇨🇳 China</option>
            <option value="US">🇺🇸 Estados Unidos</option>
            <option value="CO">🇨🇴 Colombia</option>
            <option value="VE">🇻🇪 Venezuela</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Contacto</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre de contacto" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" placeholder="email@proveedor.com" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button type="submit" disabled={create.isPending || !name} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {create.isPending ? "Creando..." : "Crear Proveedor"}
        </button>
      </form>
    </Dialog>
  );
}
