"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type {
  CartLine,
  CustomerInfo,
} from "~/components/modals/pos-checkout-dialog";
import type { PosReceiptData } from "~/components/modals/pos-receipt-dialog";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const PosCheckoutDialog = dynamic(
  () =>
    import("~/components/modals/pos-checkout-dialog").then((m) => ({
      default: m.PosCheckoutDialog,
    })),
  { ssr: false },
);

const PosReceiptDialog = dynamic(
  () =>
    import("~/components/modals/pos-receipt-dialog").then((m) => ({
      default: m.PosReceiptDialog,
    })),
  { ssr: false },
);

const CreateCustomerDialog = dynamic(
  () =>
    import("~/components/forms/create-customer").then((m) => ({
      default: m.CreateCustomerDialog,
    })),
  { ssr: false },
);

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  status: string;
  imageUrl: string | null;
}

const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    sku: "LUB-5W30-SN",
    name: "Aceite Sintético 5W-30 SN Plus 1 Galón",
    barcode: "7591234567890",
    categoryId: "cat-lubricantes",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
    sku: "FIL-OIL-PH3614",
    name: "Filtro de Aceite Sellado Automotriz PH3614",
    barcode: "7591234567891",
    categoryId: "cat-filtros",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa8",
    sku: "LUB-20W50-MIN",
    name: "Aceite Mineral 20W-50 Alto Kilometraje 1Qt",
    barcode: "7591234567892",
    categoryId: "cat-lubricantes",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa9",
    sku: "PAST-FR-CERAMIC",
    name: "Pastillas de Freno Cerámicas Delanteras D1044",
    barcode: "7591234567893",
    categoryId: "cat-frenos",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afb0",
    sku: "BUJ-IRIDIUM-IX",
    name: "Bujía Iridium IX Spark Plug CR8EIX",
    barcode: "7591234567894",
    categoryId: "cat-encendido",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afb1",
    sku: "REFR-COOL-RED50",
    name: "Refrigerante Coolant Anticongelante Rojo 50/50",
    barcode: "7591234567895",
    categoryId: "cat-lubricantes",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afb2",
    sku: "LIM-CARB-SPRAY",
    name: "Limpiador de Carburador e Inyectores Spray 450ml",
    barcode: "7591234567896",
    categoryId: "cat-quimicos",
    status: "active",
    imageUrl: null,
  },
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afb3",
    sku: "CORR-TI-132ST",
    name: "Correa de Distribución Timing Belt 132 Dientes",
    barcode: "7591234567897",
    categoryId: "cat-frenos",
    status: "active",
    imageUrl: null,
  },
];

const DEMO_CATEGORIES = [
  { id: "cat-lubricantes", name: "Lubricantes & Fluidos" },
  { id: "cat-filtros", name: "Filtros" },
  { id: "cat-frenos", name: "Frenos & Transmisión" },
  { id: "cat-encendido", name: "Encendido & Eléctrico" },
  { id: "cat-quimicos", name: "Químicos & Aditivos" },
];

export default function PosClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  // Queries
  const { data: productsData, isLoading: isLoadingProducts } = useQuery(
    trpc.catalog.listProducts.queryOptions({ limit: 100 }),
  );
  const { data: categoriesData } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );
  const { data: storeOrdersData } = useQuery(
    trpc.sales.listOrders.queryOptions({ channel: "store", limit: 100 }),
  );
  const { data: stockData } = useQuery(
    trpc.inventory.stockOverview.queryOptions({}),
  );

  const productList: ProductItem[] = useMemo(() => {
    const items =
      productsData && "items" in productsData ? productsData.items : [];
    return items.length > 0 ? items : DEMO_PRODUCTS;
  }, [productsData]);

  const categories = useMemo(() => {
    const cats = categoriesData ?? [];
    return cats.length > 0 ? cats : DEMO_CATEGORIES;
  }, [categoriesData]);

  const customers: CustomerInfo[] = useMemo(() => {
    return customersData ?? [];
  }, [customersData]);

  // Stock Map for instant lookup
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (stockData) {
      for (const row of stockData) {
        map.set(row.id, row.storeStock);
      }
    }
    return map;
  }, [stockData]);

  // POS State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts (F2: Focus Scanner, F4: Checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === "F4") {
        if (
          cart.length > 0 &&
          !checkoutOpen &&
          !receiptOpen &&
          !createCustomerOpen
        ) {
          e.preventDefault();
          setCheckoutOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, checkoutOpen, receiptOpen, createCustomerOpen]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return productList.filter((p) => {
      const matchCat =
        selectedCategory === "all" || p.categoryId === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        Boolean(p.barcode?.toLowerCase().includes(q))
      );
    });
  }, [productList, selectedCategory, searchQuery]);

  // Customer dropdown filtering
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          Boolean(c.identification?.toLowerCase().includes(q)) ||
          Boolean(c.phone?.includes(q)),
      )
      .slice(0, 8);
  }, [customers, customerSearch]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const cartDiscount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.discount * item.quantity, 0);
  }, [cart]);

  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);

  const cartDual = useMemo(
    () => formatDualCurrency(cartTotal, bcv.rate),
    [cartTotal, bcv.rate],
  );

  const totalCartUnits = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Shift / Today Stats for Compact Header Bar
  const todayStats = useMemo(() => {
    const orders = storeOrdersData ?? [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter(
      (o) => new Date(o.createdAt).toISOString().slice(0, 10) === todayStr,
    );
    const count = todayOrders.length;
    const revenue = todayOrders.reduce(
      (sum, o) => sum + (parseFloat(String(o.total)) || 0),
      0,
    );
    const avgTicket = count > 0 ? revenue / count : 0;
    return { count, revenue, avgTicket };
  }, [storeOrdersData]);

  const revenueDual = useMemo(
    () => formatDualCurrency(todayStats.revenue, bcv.rate),
    [todayStats.revenue, bcv.rate],
  );
  const avgDual = useMemo(
    () => formatDualCurrency(todayStats.avgTicket, bcv.rate),
    [todayStats.avgTicket, bcv.rate],
  );

  // Add item to cart
  const addToCart = useCallback((product: ProductItem, defaultPrice = 12.5) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((line) => line.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const curr = updated[existingIdx];
        if (curr) {
          const newQty = curr.quantity + 1;
          updated[existingIdx] = {
            ...curr,
            quantity: newQty,
            lineTotal: (curr.unitPrice - curr.discount) * newQty,
          };
        }
        return updated;
      } else {
        return [
          ...prev,
          {
            id: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 1,
            unitPrice: defaultPrice,
            discount: 0,
            lineTotal: defaultPrice,
          },
        ];
      }
    });

    // Temporary visual feedback
    setScannerFeedback(`+1 ${product.sku}`);
    setTimeout(() => setScannerFeedback(null), 1400);
  }, []);

  // Handle barcode scanner input on Enter
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = searchQuery.trim().toLowerCase();
      if (!code) return;

      // Match exact barcode or SKU first
      const exactMatch = productList.find(
        (p) =>
          p.sku.toLowerCase() === code || p.barcode?.toLowerCase() === code,
      );

      if (exactMatch) {
        addToCart(exactMatch);
        setSearchQuery("");
      } else if (filteredProducts.length === 1 && filteredProducts[0]) {
        // If only 1 product matches current search, add it
        addToCart(filteredProducts[0]);
        setSearchQuery("");
      }
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.id !== id) return line;
          const newQty = Math.max(0, line.quantity + delta);
          return {
            ...line,
            quantity: newQty,
            lineTotal: (line.unitPrice - line.discount) * newQty,
          };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const updateUnitPrice = (id: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const validPrice = Math.max(0, newPrice);
        return {
          ...line,
          unitPrice: validPrice,
          lineTotal: (validPrice - line.discount) * line.quantity,
        };
      }),
    );
  };

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch("");
  };

  const handlePaymentComplete = (receipt: PosReceiptData) => {
    setLastReceipt(receipt);
    setReceiptOpen(true);
    clearCart();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-4 p-4 duration-200 lg:p-6">
      {/* Top Header */}
      <PageHeader
        title="Terminal Punto de Venta (POS)"
        description="Mostrador de alta velocidad, lector de código de barras y cobro dual con tasa oficial BCV"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">
              <Icons.LockOpen className="mr-1 size-3" />
              Caja Abierta
            </StatusBadge>

            {/* BCV Official Rate Badge with Live Sync Button */}
            <div className="border-border bg-secondary/80 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-xs">
              <Icons.Verified className="text-primary size-4" />
              <span className="text-muted-foreground hidden sm:inline">
                BCV Oficial:
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {bcv.isLoading
                  ? "Cargando..."
                  : `Bs ${bcv.rate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
              </span>
              <button
                type="button"
                onClick={() => void bcv.syncRate()}
                disabled={bcv.isSyncing}
                title="Actualizar tasa oficial directamente desde bcv.org.ve"
                className="text-muted-foreground hover:text-primary ml-0.5 rounded p-0.5 transition-colors disabled:opacity-50"
              >
                <Icons.Sync
                  className={`size-3.5 ${bcv.isSyncing ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {cart.length > 0 && (
              <Button
                variant="outline"
                onClick={clearCart}
                className="min-h-9 text-xs"
              >
                <Icons.RestartAlt className="size-3.5" />
                Limpiar Carrito
              </Button>
            )}
          </div>
        }
      />

      {/* Compact Operational Stats Toolbar (Saves vertical space for cashier) */}
      <div className="border-border bg-card/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Icons.ReceiptLong className="text-primary size-4" />
            <span className="text-muted-foreground">Ventas Turno:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {todayStats.count} ({revenueDual.usd})
            </span>
          </div>

          <div className="text-border hidden sm:inline-block">|</div>

          <div className="hidden items-center gap-1.5 sm:flex">
            <Icons.Analytics className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Ticket Promedio:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {avgDual.usd}
            </span>
          </div>

          <div className="text-border hidden md:inline-block">|</div>

          <div className="hidden items-center gap-1.5 md:flex">
            <Icons.CalendarToday className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Fecha Valor:</span>
            <span className="text-foreground font-mono text-[11px] font-medium">
              {bcv.dateText ?? bcv.date}
            </span>
          </div>
        </div>

        {/* Active Cart Counter Chip */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              cart.length > 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icons.ShoppingCart className="size-3.5" />
            <span>
              {totalCartUnits} un. ({cart.length} ítems)
            </span>
          </div>
        </div>
      </div>

      {/* Main POS Interface: 7 cols Catalog / 5 cols Sales Ticket */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column (7 cols): Barcode Scanner + Category Selector + Product Grid */}
        <div className="space-y-3.5 lg:col-span-7">
          {/* Barcode & Search Input */}
          <div className="border-border bg-card focus-within:border-primary/60 focus-within:ring-primary/20 relative rounded-xl border p-2.5 shadow-xs transition-shadow focus-within:ring-2">
            <div className="flex items-center gap-2">
              <Icons.BarcodeScanner className="text-muted-foreground size-5 pl-1" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Escanear código de barras o escribir SKU/Nombre (Enter para agregar)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeSubmit}
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs font-medium focus:outline-none sm:text-sm"
              />
              <div className="flex items-center gap-1">
                <kbd className="border-border bg-secondary text-muted-foreground hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
                  F2
                </kbd>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <Icons.Close className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Scanner Instant Feedback Toast */}
            {scannerFeedback && (
              <div className="border-primary/40 bg-primary/10 text-primary animate-in fade-in zoom-in-95 absolute -bottom-3 left-6 z-20 flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium shadow-xs duration-150">
                <Icons.Check className="size-3" />
                <span>{scannerFeedback}</span>
              </div>
            )}
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="mobile-scroll-x flex items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Todas ({productList.length})
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const countInCat = productList.filter(
                (p) => p.categoryId === cat.id,
              ).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {cat.name} ({countInCat})
                </button>
              );
            })}
          </div>

          {/* Product Fast-Tap Cards Grid */}
          <div className="min-h-115">
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-border bg-card h-32 animate-pulse rounded-xl border p-3"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon="SearchOff"
                title="Sin productos encontrados"
                description={`No hay coincidencias para "${searchQuery}". Intente con otro término o código.`}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((p) => {
                  const stock = stockMap.get(p.id) ?? 15;
                  const priceUsd = 12.5; // Retail standard price
                  const dual = formatDualCurrency(priceUsd, bcv.rate);
                  const isLow = stock > 0 && stock <= 5;
                  const isOut = stock <= 0;
                  const inCartQty =
                    cart.find((line) => line.id === p.id)?.quantity ?? 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p, priceUsd)}
                      className={`border-border bg-card group hover:border-primary/60 hover:bg-secondary/40 relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.97] ${
                        inCartQty > 0
                          ? "border-primary/50 ring-primary/20 shadow-xs ring-1"
                          : "hover:shadow-xs"
                      }`}
                    >
                      {/* Floating In-Cart Badge */}
                      {inCartQty > 0 && (
                        <div className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium shadow-xs">
                          <Icons.ShoppingCart className="text-[10px]" />
                          <span>x{inCartQty}</span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-muted-foreground font-mono text-[10px] font-medium">
                            {p.sku}
                          </span>
                          <span
                            className={`py-0.2 rounded px-1.5 font-mono text-[9px] font-medium ${
                              isOut
                                ? "bg-destructive/15 text-destructive"
                                : isLow
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {stock} un.
                          </span>
                        </div>
                        <h4 className="text-foreground group-hover:text-primary mt-1 line-clamp-2 text-xs leading-snug font-medium transition-colors">
                          {p.name}
                        </h4>
                      </div>

                      <div className="border-border/40 mt-3 border-t pt-2">
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                          <span className="text-foreground font-mono text-sm font-black tabular-nums">
                            {dual.usd}
                          </span>
                          <span className="text-primary font-mono text-[10px] font-medium tabular-nums">
                            {dual.bs}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Live Sales Ticket */}
        <div className="lg:col-span-5">
          <div className="border-border bg-card sticky top-18 flex flex-col justify-between rounded-xl border p-4 shadow-xs">
            <div>
              {/* Ticket Top: Title & Customer Selector */}
              <div className="border-border/60 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icons.Receipt className="text-primary size-5" />
                    <h3 className="text-foreground text-xs font-medium tracking-wider uppercase">
                      Ticket de Venta (Mostrador)
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateCustomerOpen(true)}
                    className="h-7 px-2 text-[11px] font-medium"
                  >
                    <Icons.PersonAdd className="size-3" />+ Nuevo Cliente
                  </Button>
                </div>

                {/* Customer Dropdown Selector */}
                <div className="relative mt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomerDropdown((v) => !v)}
                      className="border-border bg-secondary/60 hover:bg-secondary flex flex-1 items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Icons.Person className="text-muted-foreground size-4" />
                        <div className="truncate">
                          <span className="text-foreground block truncate text-xs font-medium">
                            {selectedCustomer
                              ? selectedCustomer.name
                              : "Consumidor Final"}
                          </span>
                          <span className="text-muted-foreground block truncate font-mono text-[10px]">
                            {selectedCustomer?.identification
                              ? `RIF: ${selectedCustomer.identification}`
                              : "Sin RIF · Detal"}
                          </span>
                        </div>
                      </div>
                      <Icons.ExpandMore className="text-muted-foreground size-4" />
                    </button>

                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title="Restablecer a Consumidor Final"
                      >
                        <Icons.Close className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {showCustomerDropdown && (
                    <div className="border-border bg-card absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border p-2 shadow-lg">
                      <div className="mb-2 flex items-center justify-between gap-1.5">
                        <input
                          type="text"
                          placeholder="Buscar cliente..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="border-border bg-secondary text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomerDropdown(false);
                            setCreateCustomerOpen(true);
                          }}
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 flex size-7 items-center justify-center rounded-lg border text-xs"
                          title="Crear cliente nuevo"
                        >
                          <Icons.PersonAdd className="size-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setShowCustomerDropdown(false);
                        }}
                        className="hover:bg-secondary flex w-full items-center justify-between rounded-lg p-2 text-left text-xs transition-colors"
                      >
                        <span className="text-foreground font-medium">
                          Consumidor Final
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          Por defecto
                        </span>
                      </button>

                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowCustomerDropdown(false);
                          }}
                          className="hover:bg-secondary flex w-full items-center justify-between rounded-lg p-2 text-left text-xs transition-colors"
                        >
                          <div className="truncate pr-2">
                            <span className="text-foreground block truncate font-medium">
                              {c.name}
                            </span>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {c.identification ?? "Sin RIF"}
                            </span>
                          </div>
                          {c.phone && (
                            <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                              {c.phone}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart Items Scrollable List */}
              <div className="divide-border/40 max-h-90 min-h-55 divide-y overflow-y-auto py-2 pr-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Icons.ShoppingCartOff className="text-muted-foreground/40 size-9" />
                    <p className="text-muted-foreground mt-2 text-xs font-medium">
                      El ticket está vacío
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[11px]">
                      Escanee un código de barras o haga tap en los artículos
                    </p>
                  </div>
                ) : (
                  cart.map((line) => {
                    const lineDual = formatDualCurrency(
                      line.lineTotal,
                      bcv.rate,
                    );
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between py-2.5 text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <p className="text-foreground line-clamp-1 leading-tight font-medium">
                            {line.name}
                          </p>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 font-mono text-[10px]">
                            <span>{line.sku}</span>
                            <span>·</span>
                            <span>
                              $
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={line.unitPrice}
                                onChange={(e) =>
                                  updateUnitPrice(
                                    line.id,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="border-border bg-secondary text-foreground w-12 rounded px-1 py-0.5 font-mono text-[10px] tabular-nums"
                              />
                            </span>
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.id, -1)}
                            className="border-border bg-secondary text-foreground hover:bg-accent flex size-7 items-center justify-center rounded-lg border font-medium"
                          >
                            -
                          </button>
                          <span className="text-foreground w-6 text-center font-mono font-medium tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.id, 1)}
                            className="border-border bg-secondary text-foreground hover:bg-accent flex size-7 items-center justify-center rounded-lg border font-medium"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total & Remove */}
                        <div className="flex items-center gap-2 pl-3">
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-foreground font-medium">
                              {lineDual.usd}
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              {lineDual.bs}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="text-muted-foreground hover:text-destructive flex size-6 items-center justify-center rounded transition-colors"
                          >
                            <Icons.Delete className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ticket Bottom / Financial Totals & Big Checkout CTA */}
            <div className="border-border/60 space-y-3 border-t pt-3">
              <div className="space-y-1 text-xs">
                <div className="text-muted-foreground flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono tabular-nums">
                    ${cartSubtotal.toFixed(2)}
                  </span>
                </div>
                {cartDiscount > 0 && (
                  <div className="flex justify-between font-medium text-emerald-500">
                    <span>Descuento:</span>
                    <span className="font-mono tabular-nums">
                      -${cartDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-border/40 my-1 border-t" />
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="text-foreground font-medium tracking-wider uppercase">
                    TOTAL A COBRAR:
                  </span>
                  <div className="text-right">
                    <span className="text-foreground font-mono text-2xl font-black tabular-nums">
                      {cartDual.usd}
                    </span>
                    <div className="text-primary font-mono text-xs font-medium tabular-nums">
                      {cartDual.bs}
                    </div>
                  </div>
                </div>
              </div>

              {/* Big Action Button: Cobrar Venta with F4 hint */}
              <Button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="min-h-12 w-full text-sm font-medium shadow-md"
              >
                <Icons.Payments className="size-4.5" />
                Cobrar Venta ({cartDual.usd})
                <kbd className="bg-primary-foreground/20 text-primary-foreground ml-2 hidden rounded px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
                  F4
                </kbd>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Dialog */}
      <CreateCustomerDialog
        open={createCustomerOpen}
        onClose={() => setCreateCustomerOpen(false)}
        onCustomerCreated={(newCust) => {
          setSelectedCustomer({
            id: newCust.id,
            name: newCust.name,
            identification: newCust.identification,
            phone: newCust.phone,
            customerType: newCust.customerType,
          });
          setCreateCustomerOpen(false);
        }}
      />

      {/* Spacious 2-Column Checkout Dialog */}
      <PosCheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={{
          items: cart,
          subtotal: cartSubtotal,
          discount: cartDiscount,
          total: cartTotal,
        }}
        customer={selectedCustomer}
        bcvRate={bcv.rate}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* Thermal Receipt Dialog */}
      <PosReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={lastReceipt}
        onNewSale={() => {
          clearCart();
          barcodeInputRef.current?.focus();
        }}
      />
    </div>
  );
}
