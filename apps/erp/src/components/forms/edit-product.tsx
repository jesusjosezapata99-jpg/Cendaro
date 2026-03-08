"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "~/components/dialog";

interface EditProductDialogProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    barcode: string | null;
    descriptionShort: string | null;
    status: string;
  };
}

export function EditProductDialog({ open, onClose, product }: EditProductDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState(product.name);
  const [barcode, setBarcode] = useState(product.barcode ?? "");
  const [description, setDescription] = useState(product.descriptionShort ?? "");
  const [status, setStatus] = useState(product.status);

  useEffect(() => {
    setName(product.name);
    setBarcode(product.barcode ?? "");
    setDescription(product.descriptionShort ?? "");
    setStatus(product.status);
  }, [product]);

  const update = useMutation(
    trpc.catalog.updateProduct.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        onClose();
      },
    }),
  );

  return (
    <Dialog open={open} onClose={onClose} title={`Editar — ${product.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            id: product.id,
            name: name !== product.name ? name : undefined,
            barcode: barcode !== (product.barcode ?? "") ? barcode : undefined,
            descriptionShort: description !== (product.descriptionShort ?? "") ? description : undefined,
            status: status !== product.status ? (status as "active" | "draft" | "discontinued") : undefined,
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Código de Barras</label>
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción Corta</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="discontinued">Descontinuado</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
        <button type="submit" disabled={update.isPending} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {update.isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </Dialog>
  );
}
