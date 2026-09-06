"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Dialog, Field, FormActions, Input } from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
  listing: {
    id: string;
    mlItemId: string;
    title: string;
    price: number;
    stockSynced: number | null;
    status: string;
  } | null;
}

export function SyncMlListingDialog({ open, onClose, listing }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (listing) {
      setStock(String(listing.stockSynced));
      setPrice(String(listing.price));
    }
  }, [listing]);

  const sync = useMutation(
    trpc.integrations.syncMlListing.mutationOptions({
      onSuccess: () => {
        toast.success("Publicación sincronizada con Mercado Libre");
        void qc.invalidateQueries({ queryKey: [["integrations"]] });
        onClose();
      },
      onError: (err) => {
        toast.error(`Error al sincronizar: ${err.message}`);
      },
    }),
  );

  if (!listing) return null;

  const parsedPrice = parseFloat(price) || 0;
  const dualPrice = formatDualCurrency(parsedPrice, bcv.rate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      toast.error("El stock debe ser un número entero mayor o igual a 0");
      return;
    }

    sync.mutate({
      id: listing.id,
      stock: parsedStock,
      price: parsedPrice > 0 ? parsedPrice : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sincronizar Publicación ML"
      description={`Actualización directa de stock y precio para ${listing.mlItemId}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="surface-card rounded-lg p-3 text-xs">
          <p className="text-muted-foreground font-mono font-medium">
            {listing.mlItemId}
          </p>
          <p className="text-foreground mt-0.5 line-clamp-2 font-medium">
            {listing.title}
          </p>
        </div>

        <Field label="Stock Disponible para Mercado Libre" required>
          <Input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
            required
            autoFocus
          />
        </Field>

        <Field label="Precio de Publicación (USD)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
          {bcv.rate > 0 && parsedPrice > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              Equivalente oficial BCV:{" "}
              <span className="text-foreground font-mono font-medium">
                {dualPrice.bs}
              </span>
            </p>
          )}
        </Field>

        <FormActions
          onCancel={onClose}
          submitLabel="Sincronizar con Mercado Libre"
          submitting={sync.isPending}
        />
      </form>
    </Dialog>
  );
}
