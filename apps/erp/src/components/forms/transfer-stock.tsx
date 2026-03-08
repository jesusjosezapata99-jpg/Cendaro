"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Field, Input, Select, FormActions } from "~/components/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CHANNELS = [
  { value: "store", label: "Tienda" },
  { value: "mercadolibre", label: "Mercado Libre" },
  { value: "vendors", label: "Vendedores" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
] as const;

export function TransferStockDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: productsData } = useQuery(trpc.catalog.listProducts.queryOptions({ limit: 100 }));
  const productList = useMemo(
    () => (productsData && "items" in productsData ? productsData.items : []),
    [productsData],
  );

  const transfer = useMutation(
    trpc.inventory.transferStock.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
        onClose();
      },
    }),
  );

  const [form, setForm] = useState({
    productId: "",
    fromChannel: "store",
    toChannel: "mercadolibre",
    quantity: "1",
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    transfer.mutate({
      productId: form.productId,
      fromChannel: form.fromChannel as "store" | "mercadolibre" | "vendors" | "whatsapp" | "instagram",
      toChannel: form.toChannel as "store" | "mercadolibre" | "vendors" | "whatsapp" | "instagram",
      quantity: parseInt(form.quantity, 10),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Transferir Stock" description="Mueve stock entre canales de venta.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Producto" required>
          <Select value={form.productId} onChange={(e) => set("productId", e.target.value)} required>
            <option value="">Seleccionar producto...</option>
            {productList.map((p: { id: string; name: string; sku: string }) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Desde" required>
            <Select value={form.fromChannel} onChange={(e) => set("fromChannel", e.target.value)}>
              {CHANNELS.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
            </Select>
          </Field>
          <Field label="Hacia" required>
            <Select value={form.toChannel} onChange={(e) => set("toChannel", e.target.value)}>
              {CHANNELS.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Cantidad" required>
          <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} required />
        </Field>

        {transfer.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {transfer.error.message}
          </div>
        )}

        <FormActions onCancel={onClose} submitting={transfer.isPending} submitLabel="Transferir" />
      </form>
    </Dialog>
  );
}
