"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { isFiscalInvoiceReady } from "@cendaro/validators";

import type {
  CartLine,
  CategoryItem,
  CustomerInfo,
  PosReceiptData,
  ProductItem,
} from "~/modules/pos";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { useDebounce } from "~/hooks/use-debounce";
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

export default function PosClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  // POS State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedProductSearch = useDebounce(searchQuery.trim(), 200);

  // Queries
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    ...trpc.catalog.listProducts.queryOptions({
      limit: 100,
      status: "active",
      search: debouncedProductSearch || undefined,
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    }),
    placeholderData: keepPreviousData,
  });
  const { data: categoriesData } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  // Customer lookup runs on the server so the whole customer base is
  // searchable (name, phone, RIF/cédula with or without dashes).
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebounce(customerSearch.trim(), 300);
  const { data: customersData } = useQuery({
    ...trpc.sales.listCustomers.queryOptions({
      limit: 20,
      // Single characters would match almost everything; wait for two.
      search:
        debouncedCustomerSearch.length >= 2
          ? debouncedCustomerSearch
          : undefined,
    }),
    placeholderData: keepPreviousData,
  });
  const { data: storeOrdersData } = useQuery(
    trpc.sales.listOrders.queryOptions({ channel: "store", limit: 100 }),
  );
  const { data: closuresData } = useQuery(
    trpc.sales.listClosures.queryOptions(),
  );
  const { data: stockData } = useQuery(
    trpc.inventory.stockOverview.queryOptions({}),
  );

  const productList: ProductItem[] = useMemo(() => {
    return productsData && "items" in productsData ? productsData.items : [];
  }, [productsData]);

  const totalProductCount = useMemo(() => {
    return productsData &&
      "total" in productsData &&
      typeof productsData.total === "number"
      ? productsData.total
      : productList.length;
  }, [productsData, productList.length]);

  const categories: CategoryItem[] = useMemo(() => {
    return categoriesData ?? [];
  }, [categoriesData]);

  const customers: CustomerInfo[] = useMemo(() => {
    return customersData ?? [];
  }, [customersData]);

  const isRegisterClosedToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (closuresData ?? []).some(
      (c) => new Date(c.closureDate).toISOString().slice(0, 10) === todayStr,
    );
  }, [closuresData]);

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

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(
    null,
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // SENIAT: a registered buyer needs complete fiscal data before the sale is
  // invoiced (the server rejects it too). Consumidor Final is always allowed.
  const customerFiscalReady =
    !selectedCustomer || isFiscalInvoiceReady(selectedCustomer);
  const canCheckout = cart.length > 0 && customerFiscalReady;

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
          canCheckout &&
          !checkoutOpen &&
          !receiptOpen &&
          !createCustomerOpen &&
          !editCustomerOpen
        ) {
          e.preventDefault();
          setCheckoutOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canCheckout,
    checkoutOpen,
    receiptOpen,
    createCustomerOpen,
    editCustomerOpen,
  ]);

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
    (product: ProductItem, overridePrice?: number) => {
      const unitPrice =
        overridePrice ?? product.posPriceUsd ?? product.basePriceUsd ?? 0;
      const availableStock = stockMap.get(product.id) ?? 0;
      if (unitPrice <= 0 || availableStock <= 0) {
        return;
      }

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
              unitPrice,
              discount: 0,
              lineTotal: unitPrice,
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
    [refocusScanner, stockMap],
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
        isRegisterClosedToday={isRegisterClosedToday}
      />

      {/* Main POS Interface: 7 cols Catalog / 5 cols Sales Ticket */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Module 2: Left Column (7 cols): Barcode Scanner + Category Selector + Product Grid */}
        <div className="lg:col-span-7">
          <ProductGrid
            products={filteredProducts}
            categories={categories}
            totalProductCount={totalProductCount}
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
              onEditCustomer={() => setEditCustomerOpen(true)}
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
              disabled={!canCheckout}
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
            address: newCust.address,
            phone: newCust.phone,
            customerType: newCust.customerType,
          });
          setCreateCustomerOpen(false);
          refocusScanner();
        }}
      />

      {/* Complete the selected customer's fiscal data */}
      <CreateCustomerDialog
        open={editCustomerOpen}
        customerId={selectedCustomer?.id}
        onClose={() => {
          setEditCustomerOpen(false);
          refocusScanner();
        }}
        onCustomerUpdated={(cust) => {
          setSelectedCustomer({
            id: cust.id,
            name: cust.name,
            identification: cust.identification,
            address: cust.address,
            phone: cust.phone,
            customerType: cust.customerType,
          });
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
