"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  productRef: string;
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

  // ── Typeahead state ─────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [addQuantity, setAddQuantity] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addDiscount, setAddDiscount] = useState("0");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return productList
      .filter(
        (p: {
          id: string;
          name: string;
          sku: string;
          barcode: string | null;
        }) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [productSearch, productList]);

  // Reset form state when dialog reopens
  useEffect(() => {
    if (open) {
      setCustomerId("");
      setChannel("store");
      setNotes("");
      setLines([]);
      setProductSearch("");
      setShowDropdown(false);
      setAddQuantity("1");
      setAddPrice("");
      setAddDiscount("0");
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectProduct = useCallback(
    (product: { id: string; name: string; sku: string }) => {
      setProductSearch(`${product.sku} — ${product.name}`);
      setShowDropdown(false);
      // Focus quantity input after selection
      setTimeout(() => quantityInputRef.current?.focus(), 50);
    },
    [],
  );

  const getSelectedProduct = useCallback(() => {
    // Find product matching current search by exact sku prefix
    const skuPart = productSearch.split(" — ")[0]?.trim();
    if (!skuPart) return null;
    return (
      productList.find(
        (p: { id: string; sku: string }) =>
          p.sku.toLowerCase() === skuPart.toLowerCase(),
      ) ?? null
    );
  }, [productSearch, productList]);

  const addLine = useCallback(() => {
    const product = getSelectedProduct();
    if (!product || !addPrice) return;
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productRef: product.sku,
        quantity: parseInt(addQuantity, 10) || 1,
        unitPrice: parseFloat(addPrice) || 0,
        discount: parseFloat(addDiscount) || 0,
      },
    ]);
    setProductSearch("");
    setAddQuantity("1");
    setAddPrice("");
    setAddDiscount("0");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [getSelectedProduct, addPrice, addQuantity, addDiscount]);

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || filteredProducts.length === 0) {
        if (e.key === "ArrowDown" && productSearch.trim()) {
          setShowDropdown(true);
          setHighlightIdx(0);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filteredProducts.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const product = filteredProducts[highlightIdx];
        if (product) selectProduct(product);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [
      showDropdown,
      filteredProducts,
      highlightIdx,
      selectProduct,
      productSearch,
    ],
  );

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

  const selectedProduct = getSelectedProduct();

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
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[10px] uppercase">
                    <th className="px-3 py-2">Ref.</th>
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
                      <td className="text-primary px-3 py-2 font-mono text-[11px] font-bold">
                        {line.productRef}
                      </td>
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

          {/* Add line — Typeahead */}
          <div className="space-y-2">
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <span className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowDropdown(true);
                    setHighlightIdx(0);
                  }}
                  onFocus={() => {
                    if (productSearch.trim()) setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe la referencia, nombre o código de barras..."
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-[44px] w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm transition-colors outline-none focus:ring-2"
                />
                {selectedProduct && (
                  <span className="material-symbols-outlined pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-emerald-400">
                    check_circle
                  </span>
                )}
              </div>

              {/* Dropdown results */}
              {showDropdown && filteredProducts.length > 0 && (
                <div className="border-border bg-card absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-xl">
                  {filteredProducts.map(
                    (
                      p: {
                        id: string;
                        name: string;
                        sku: string;
                        barcode: string | null;
                      },
                      idx: number,
                    ) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(p)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                          idx === highlightIdx
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <span className="text-primary shrink-0 font-mono text-xs font-bold">
                          {p.sku}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                        </span>
                        {p.barcode && (
                          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                            {p.barcode}
                          </span>
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}

              {showDropdown &&
                productSearch.trim() &&
                filteredProducts.length === 0 && (
                  <div className="border-border bg-card text-muted-foreground absolute z-50 mt-1 w-full rounded-lg border p-3 text-center text-xs shadow-xl">
                    <span className="material-symbols-outlined mb-1 block text-lg">
                      search_off
                    </span>
                    No se encontró ningún producto
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4 sm:gap-2">
              <input
                ref={quantityInputRef}
                type="number"
                min="1"
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                placeholder="Cant."
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-[44px] w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
              />
              <Input
                type="number"
                step="0.01"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="Precio $"
              />
              <Input
                type="number"
                step="0.01"
                value={addDiscount}
                onChange={(e) => setAddDiscount(e.target.value)}
                placeholder="Desc. $"
              />
              <button
                type="button"
                onClick={addLine}
                disabled={!selectedProduct || !addPrice}
                className="bg-secondary text-muted-foreground hover:bg-accent flex min-h-[44px] items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">add</span>{" "}
                Agregar
              </button>
            </div>
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
