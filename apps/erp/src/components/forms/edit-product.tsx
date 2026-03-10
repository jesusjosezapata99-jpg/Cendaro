"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  TextArea,
} from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

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

export function EditProductDialog({
  open,
  onClose,
  product,
}: EditProductDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState(product.name);
  const [barcode, setBarcode] = useState(product.barcode ?? "");
  const [description, setDescription] = useState(
    product.descriptionShort ?? "",
  );
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
            descriptionShort:
              description !== (product.descriptionShort ?? "")
                ? description
                : undefined,
            status:
              status !== product.status
                ? (status as "active" | "draft" | "discontinued")
                : undefined,
          });
        }}
        className="space-y-4"
      >
        <Field label="Nombre" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Código de Barras">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="font-mono"
          />
        </Field>

        <Field label="Descripción Corta">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>

        <Field label="Estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="discontinued">Descontinuado</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </Field>

        {update.error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
            {update.error.message}
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitting={update.isPending}
          submitLabel="Guardar Cambios"
        />
      </form>
    </Dialog>
  );
}
