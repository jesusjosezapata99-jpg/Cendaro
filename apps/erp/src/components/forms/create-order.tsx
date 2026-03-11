"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Dialog, Field, FormActions, Input, Select } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export function CreateOrderDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: customers } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );
  const { data: productsData } = useQuery(
    trpc.catalog.listProducts.queryOptions({ limit: 100 }),
  );
  const productList = useMemo(
    () => (productsData && "items" in productsData ? productsData.items : []),
    [productsData],
  );

  const create = useMutation(
    trpc.sales.createOrder.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        onClose();
      },
    }),
  );

  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("store");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [addProduct, setAddProduct] = useState({
    productId: "",
    quantity: "1",
    unitPrice: "",
    discount: "0",
  });

  // Reset form state when dialog reopens
  useEffect(() => {
    if (open) {
      setCustomerId("");
      setChannel("store");
      setNotes("");
      setLines([]);
      setAddProduct({
        productId: "",
        quantity: "1",
        unitPrice: "",
        discount: "0",
      });
    }
  }, [open]);

  const addLine = useCallback(() => {
    if (!addProduct.productId || !addProduct.unitPrice) return;
    const product = productList.find(
      (p: { id: string; name: string }) => p.id === addProduct.productId,
    );
    setLines((prev) => [
      ...prev,
      {
        productId: addProduct.productId,
        productName: product?.name ?? "—",
        quantity: parseInt(addProduct.quantity, 10) || 1,
        unitPrice: parseFloat(addProduct.unitPrice) || 0,
        discount: parseFloat(addProduct.discount) || 0,
      },
    ]);
    setAddProduct({
      productId: "",
      quantity: "1",
      unitPrice: "",
      discount: "0",
    });
  }, [addProduct, productList]);

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount * l.quantity, 0);
  const total = subtotal - totalDiscount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;
    create.mutate({
      customerId: customerId || undefined,
      channel: channel as
        | "store"
        | "mercadolibre"
        | "vendors"
        | "whatsapp"
        | "instagram",
      notes: notes || undefined,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva Orden"
      description="Crea una orden de venta."
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <Select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Cliente de mostrador</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Canal" required>
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="store">Tienda</option>
              <option value="mercadolibre">Mercado Libre</option>
              <option value="vendors">Vendedores</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </Select>
          </Field>
        </div>

        {/* Order lines */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Líneas de Pedido
          </p>
          {lines.length > 0 && (
            <div className="border-border mobile-scroll-x mb-3 overflow-hidden rounded-lg border">
              <table className="w-full min-w-[400px] text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[10px] uppercase">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Desc.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr
                      key={idx}
                      className="border-border border-b last:border-0"
                    >
                      <td className="text-foreground px-3 py-2">
                        {line.productName}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-right">
                        {line.quantity}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                        ${line.unitPrice.toFixed(2)}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                        ${line.discount.toFixed(2)}
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono font-bold">
                        $
                        {(
                          (line.unitPrice - line.discount) *
                          line.quantity
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <span className="material-symbols-outlined text-sm">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add line row */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5 sm:gap-2">
            <div className="col-span-2">
              <Select
                value={addProduct.productId}
                onChange={(e) =>
                  setAddProduct((p) => ({ ...p, productId: e.target.value }))
                }
              >
                <option value="">Seleccionar producto...</option>
                {productList.map(
                  (p: { id: string; name: string; sku: string }) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ),
                )}
              </Select>
            </div>
            <Input
              type="number"
              min="1"
              value={addProduct.quantity}
              onChange={(e) =>
                setAddProduct((p) => ({ ...p, quantity: e.target.value }))
              }
              placeholder="Cant."
            />
            <Input
              type="number"
              step="0.01"
              value={addProduct.unitPrice}
              onChange={(e) =>
                setAddProduct((p) => ({ ...p, unitPrice: e.target.value }))
              }
              placeholder="Precio $"
            />
            <button
              type="button"
              onClick={addLine}
              disabled={!addProduct.productId || !addProduct.unitPrice}
              className="bg-secondary text-muted-foreground hover:bg-accent flex min-h-[44px] items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">add</span>{" "}
              Agregar
            </button>
          </div>
        </div>

        {/* Totals */}
        {lines.length > 0 && (
          <div className="flex justify-end">
            <div className="border-border bg-secondary rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground font-mono font-bold">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Descuento:</span>
                  <span className="font-mono text-red-400">
                    -${totalDiscount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-border mt-1 flex justify-between gap-8 border-t pt-1">
                <span className="text-foreground font-bold">Total:</span>
                <span className="text-primary font-mono text-lg font-bold">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <Field label="Notas">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales..."
          />
        </Field>

        {create.error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
            {create.error.message}
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Crear Orden"
        />
      </form>
    </Dialog>
  );
}
