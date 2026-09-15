"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import type {
  CartLine,
  CategoryItem,
  CustomerInfo,
  PosReceiptData,
  ProductItem,
} from "~/modules/pos";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import {
  PosCart,
  PosPaymentPanel,
  PosToolbar,
  ProductGrid,
} from "~/modules/pos";
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

const DEMO_CATEGORIES: CategoryItem[] = [
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

  // Scanner Focus Retention Helper (T6.3)
  const refocusScanner = useCallback(() => {
    // Only refocus if user is not actively typing in an input (e.g. price edit or customer search)
    const activeEl = document.activeElement;
    const isEditingOtherInput =
      activeEl instanceof HTMLInputElement &&
      activeEl !== barcodeInputRef.current;
    if (!isEditingOtherInput) {
      barcodeInputRef.current?.focus();
    }
  }, []);

  // Initial focus on mount
  useEffect(() => {
    refocusScanner();
  }, [refocusScanner]);

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

  // Add item to cart + preserve scanner focus (T6.3)
  const addToCart = useCallback(
    (product: ProductItem, defaultPrice = 12.5) => {
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

      // Restore scanner focus immediately
      refocusScanner();
    },
    [refocusScanner],
  );

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
    refocusScanner();
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
    refocusScanner();
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch("");
    refocusScanner();
  };

  const handlePaymentComplete = (receipt: PosReceiptData) => {
    setLastReceipt(receipt);
    setReceiptOpen(true);
    clearCart();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-4 py-4 duration-200 lg:py-6">
      {/* Module 1: PosToolbar */}
      <PosToolbar
        bcv={bcv}
        todayStats={todayStats}
        revenueDual={revenueDual}
        avgDual={avgDual}
        cartLength={cart.length}
        totalCartUnits={totalCartUnits}
        onClearCart={clearCart}
      />

      {/* Main POS Interface: 7 cols Catalog / 5 cols Sales Ticket */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Module 2: Left Column (7 cols): Barcode Scanner + Category Selector + Product Grid */}
        <div className="lg:col-span-7">
          <ProductGrid
            products={filteredProducts}
            categories={categories}
            totalProductCount={productList.length}
            selectedCategory={selectedCategory}
            onSelectCategory={(catId) => {
              setSelectedCategory(catId);
              refocusScanner();
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onBarcodeSubmit={handleBarcodeSubmit}
            barcodeInputRef={barcodeInputRef}
            scannerFeedback={scannerFeedback}
            isLoading={isLoadingProducts}
            stockMap={stockMap}
            bcvRate={bcv.rate}
            cart={cart}
            onAddToCart={addToCart}
          />
        </div>

        {/* Right Column (5 cols): Live Sales Ticket + Payment Panel */}
        <div className="lg:col-span-5">
          <div className="border-border bg-card sticky top-18 flex flex-col justify-between border p-4 shadow-xs">
            {/* Module 3: PosCart */}
            <PosCart
              cart={cart}
              bcvRate={bcv.rate}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={(cust) => {
                setSelectedCustomer(cust);
                refocusScanner();
              }}
              onCreateCustomer={() => setCreateCustomerOpen(true)}
              customers={customers}
              customerSearch={customerSearch}
              onCustomerSearchChange={setCustomerSearch}
              showCustomerDropdown={showCustomerDropdown}
              onToggleCustomerDropdown={(open) =>
                setShowCustomerDropdown((v) =>
                  typeof open === "boolean" ? open : !v,
                )
              }
              onUpdateQuantity={updateQuantity}
              onUpdateUnitPrice={updateUnitPrice}
              onRemoveLine={removeLine}
            />

            {/* Module 4: PosPaymentPanel */}
            <PosPaymentPanel
              subtotal={cartSubtotal}
              discount={cartDiscount}
              cartDual={cartDual}
              disabled={cart.length === 0}
              onCheckout={() => setCheckoutOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Quick Add Customer Dialog */}
      <CreateCustomerDialog
        open={createCustomerOpen}
        onClose={() => {
          setCreateCustomerOpen(false);
          refocusScanner();
        }}
        onCustomerCreated={(newCust) => {
          setSelectedCustomer({
            id: newCust.id,
            name: newCust.name,
            identification: newCust.identification,
            phone: newCust.phone,
            customerType: newCust.customerType,
          });
          setCreateCustomerOpen(false);
          refocusScanner();
        }}
      />

      {/* Spacious 2-Column Checkout Dialog */}
      <PosCheckoutDialog
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          refocusScanner();
        }}
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
        onClose={() => {
          setReceiptOpen(false);
          refocusScanner();
        }}
        receipt={lastReceipt}
        onNewSale={() => {
          clearCart();
          barcodeInputRef.current?.focus();
        }}
      />
    </div>
  );
}
