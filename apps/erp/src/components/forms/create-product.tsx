"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Field, Input, Select, TextArea } from "~/components/dialog";
import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

const initialState = {
  sku: "",
  name: "",
  barcode: "",
  descriptionShort: "",
  descriptionLong: "",
  brandId: "",
  categoryId: "",
  supplierId: "",
  imageUrl: "",
  weight: "",
  volume: "",
  status: "draft" as const,
};

export function CreateProductDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: brands } = useQuery(trpc.catalog.listBrands.queryOptions());
  const { data: categories } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const { data: suppliers } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );

  const create = useMutation(
    trpc.catalog.createProduct.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        onClose();
      },
    }),
  );

  const [form, setForm] = useState(initialState);

  // Reset form state when dialog reopens
  useEffect(() => {
    if (open) setForm(initialState);
  }, [open]);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      sku: form.sku,
      name: form.name,
      barcode: form.barcode || undefined,
      descriptionShort: form.descriptionShort || undefined,
      descriptionLong: form.descriptionLong || undefined,
      brandId: form.brandId || undefined,
      categoryId: form.categoryId || undefined,
      supplierId: form.supplierId || undefined,
      imageUrl: form.imageUrl || undefined,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      volume: form.volume ? parseFloat(form.volume) : undefined,
      status: form.status,
    });
  };

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Nuevo Producto"
      description="Registra un nuevo producto en el catálogo."
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <SheetBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" required>
              <Input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="REF-001"
                required
              />
            </Field>
            <Field label="Código de Barras" hint="EAN/UPC">
              <Input
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                placeholder="7501234567890"
              />
            </Field>
          </div>

          <Field label="Nombre del Producto" required>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Cable USB-C Premium 1.5m"
              required
            />
          </Field>

          <Field label="Descripción Corta">
            <Input
              value={form.descriptionShort}
              onChange={(e) => set("descriptionShort", e.target.value)}
              placeholder="Breve descripción del producto"
            />
          </Field>

          <Field label="Descripción Larga">
            <TextArea
              value={form.descriptionLong}
              onChange={(e) => set("descriptionLong", e.target.value)}
              rows={3}
              placeholder="Descripción detallada..."
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Marca">
              <Select
                value={form.brandId}
                onChange={(e) => set("brandId", e.target.value)}
              >
                <option value="">Sin marca</option>
                {(brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoría">
              <Select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Sin categoría</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Proveedor">
              <Select
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
              >
                <option value="">Sin proveedor</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Peso (kg)">
              <Input
                type="number"
                step="0.01"
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                placeholder="0.15"
              />
            </Field>
            <Field label="Volumen (m³)">
              <Input
                type="number"
                step="0.001"
                value={form.volume}
                onChange={(e) => set("volume", e.target.value)}
                placeholder="0.002"
              />
            </Field>
            <Field label="Estado">
              <Select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="discontinued">Descontinuado</option>
              </Select>
            </Field>
          </div>

          <Field label="URL de Imagen">
            <Input
              type="url"
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>

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
            submitLabel="Crear Producto"
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}
