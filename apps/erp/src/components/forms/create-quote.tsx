"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Dialog, Field, FormActions, Input, Select } from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface QuoteLine {
  productId: string;
  productName: string;
  productRef: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export function CreateQuoteDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

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
    trpc.quotes.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["quotes"]] });
        onClose();
      },
    }),
  );

  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("store");
  const [validityDays, setValidityDays] = useState("15");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);

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
      setValidityDays("15");
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
      setTimeout(() => quantityInputRef.current?.focus(), 50);
    },
    [],
  );

  const getSelectedProduct = useCallback(() => {
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
  const total = Math.max(0, subtotal - totalDiscount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;

    const days = parseInt(validityDays, 10) || 15;
    const validUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    create.mutate({
      customerId: customerId || undefined,
      channel: channel as
        "store" | "mercadolibre" | "vendors" | "whatsapp" | "instagram",
      validUntil: validUntilDate.toISOString(),
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
      title="Nueva Cotización"
      description="Crea una propuesta comercial para un cliente."
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Cliente">
            <Select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Cliente general / Mostrador</option>
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
          <Field label="Validez">
            <Select
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
            >
              <option value="7">7 días</option>
              <option value="15">15 días</option>
              <option value="30">30 días</option>
              <option value="60">60 días</option>
            </Select>
          </Field>
        </div>

        {/* Quote lines */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
            Líneas de la Cotización
          </p>
          {lines.length > 0 && (
            <div className="border-border-subtle surface-card mobile-scroll-x mb-3 overflow-hidden rounded-lg border">
              <table className="w-full min-w-125 text-left text-xs">
                <thead>
                  <tr className="border-border-subtle text-muted-foreground border-b text-[10px] tracking-widest uppercase">
                    <th className="px-3 py-2">Ref.</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio Unit.</th>
                    <th className="px-3 py-2 text-right">Desc. Unit.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr
                      key={idx}
                      className="border-border-subtle border-b last:border-0"
                    >
                      <td className="text-primary px-3 py-2 font-mono font-bold">
                        {line.productRef}
                      </td>
                      <td className="text-foreground max-w-50 truncate px-3 py-2">
                        {line.productName}
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono tabular-nums">
                        ${line.unitPrice.toFixed(2)}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-right font-mono tabular-nums">
                        {line.discount > 0
                          ? `-$${line.discount.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono font-semibold tabular-nums">
                        $
                        {(
                          (line.unitPrice - line.discount) *
                          line.quantity
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
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
                  className="border-border-subtle bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-11 w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm transition-colors outline-none focus:ring-2"
                />
                {selectedProduct && (
                  <span className="material-symbols-outlined pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-emerald-400">
                    check_circle
                  </span>
                )}
              </div>

              {/* Dropdown results */}
              {showDropdown && filteredProducts.length > 0 && (
                <div className="border-border-subtle bg-card absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-xl">
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
                  <div className="border-border-subtle bg-card text-muted-foreground absolute z-50 mt-1 w-full rounded-lg border p-3 text-center text-xs shadow-xl">
                    <span className="material-symbols-outlined mb-1 block text-lg">
                      search_off
                    </span>
                    No se encontró ningún producto
                  </div>
                )}
            </div>

            {/* Quantity, Price, Discount, Add */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-20">
                <label className="text-muted-foreground mb-1 block text-[10px] tracking-wider uppercase">
                  Cant.
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLine();
                    }
                  }}
                  className="border-border-subtle bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-11 w-full rounded-lg border px-3 py-2.5 font-mono text-sm tabular-nums transition-colors outline-none focus:ring-2"
                />
              </div>
              <div className="w-28">
                <label className="text-muted-foreground mb-1 block text-[10px] tracking-wider uppercase">
                  Precio Unit. ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLine();
                    }
                  }}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="w-28">
                <label className="text-muted-foreground mb-1 block text-[10px] tracking-wider uppercase">
                  Desc. Unit. ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addDiscount}
                  onChange={(e) => setAddDiscount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLine();
                    }
                  }}
                  className="font-mono tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={addLine}
                disabled={!selectedProduct || !addPrice}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">add</span>{" "}
                Añadir
              </button>
            </div>
          </div>
        </div>

        <Field label="Notas / Términos">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="border-border-subtle bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border p-2.5 text-sm transition-colors outline-none focus:ring-2"
            placeholder="Términos comerciales, tiempo de entrega, condiciones..."
          />
        </Field>

        {/* Totals Summary */}
        <div className="border-border-subtle surface-card rounded-lg border p-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground font-mono tabular-nums">
              ${subtotal.toFixed(2)}
            </span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-xs text-amber-500">
              <span>Descuento</span>
              <span className="font-mono tabular-nums">
                -${totalDiscount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="border-border-subtle mt-2 flex items-baseline justify-between border-t pt-2">
            <span className="text-foreground text-sm font-semibold">Total</span>
            <div className="text-right">
              <span className="text-primary font-mono text-base font-bold tabular-nums">
                ${total.toFixed(2)}
              </span>
              {bcv.rate > 0 && (
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  {formatDualCurrency(total, bcv.rate).bs}
                </p>
              )}
            </div>
          </div>
        </div>

        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Crear Cotización"
        />
      </form>
    </Dialog>
  );
}
