"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { UserRole } from "@cendaro/validators";
import { cn } from "@cendaro/ui";

import { hasRole } from "~/components/role-guard";
import { useCurrentUser } from "~/hooks/use-current-user";
import { useTRPC } from "~/trpc/client";

/* ─── Route definitions (mirrored from sidebar navSections) ─── */
interface SearchRoute {
  label: string;
  path: string;
  icon: string;
  keywords: string;
  roles?: UserRole[];
}

const ROUTES: SearchRoute[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "dashboard",
    keywords: "inicio panel kpi",
  },
  {
    label: "Catálogo",
    path: "/catalog",
    icon: "inventory_2",
    keywords: "productos sku",
  },
  {
    label: "Marcas",
    path: "/catalog/brands",
    icon: "branding_watermark",
    keywords: "brand marca",
  },
  {
    label: "Categorías",
    path: "/catalog/categories",
    icon: "category",
    keywords: "categoría tree",
  },
  {
    label: "Proveedores",
    path: "/catalog/suppliers",
    icon: "local_shipping",
    keywords: "proveedor supplier",
  },
  {
    label: "Inventario",
    path: "/inventory",
    icon: "warehouse",
    keywords: "stock almacén",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Contenedores",
    path: "/containers",
    icon: "package_2",
    keywords: "container importación fob",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Precios",
    path: "/pricing",
    icon: "sell",
    keywords: "repricing precio",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Tasas de Cambio",
    path: "/rates",
    icon: "currency_exchange",
    keywords: "tasa bcv dólar paralelo usdt",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Punto de Venta",
    path: "/pos",
    icon: "point_of_sale",
    keywords: "pos venta",
    roles: ["owner", "admin", "supervisor", "employee"],
  },
  {
    label: "Pedidos",
    path: "/orders",
    icon: "list_alt",
    keywords: "pedido venta order",
  },
  {
    label: "Cotizaciones",
    path: "/quotes",
    icon: "request_quote",
    keywords: "cotización quote",
  },
  {
    label: "Notas de Entrega",
    path: "/delivery-notes",
    icon: "local_shipping",
    keywords: "nota entrega",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Facturas",
    path: "/invoices",
    icon: "description",
    keywords: "factura invoice",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Vendedores",
    path: "/vendors",
    icon: "group",
    keywords: "vendedor comisión",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Clientes",
    path: "/customers",
    icon: "person",
    keywords: "cliente customer",
  },
  {
    label: "Mercado Libre",
    path: "/marketplace",
    icon: "storefront",
    keywords: "mercadolibre ml",
    roles: ["owner", "admin", "supervisor", "marketing"],
  },
  {
    label: "WhatsApp",
    path: "/whatsapp",
    icon: "chat",
    keywords: "whatsapp chat",
    roles: ["owner", "admin", "supervisor", "employee"],
  },
  {
    label: "Pagos",
    path: "/payments",
    icon: "payments",
    keywords: "pago cobro",
    roles: ["owner", "admin", "supervisor", "employee"],
  },
  {
    label: "Cierre de Caja",
    path: "/cash-closure",
    icon: "lock_clock",
    keywords: "caja cierre",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "CxC",
    path: "/accounts-receivable",
    icon: "receipt_long",
    keywords: "cuenta cobrar",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Alertas",
    path: "/alerts",
    icon: "notifications_active",
    keywords: "alerta warning",
    roles: ["owner", "admin", "supervisor"],
  },
  {
    label: "Usuarios",
    path: "/users",
    icon: "manage_accounts",
    keywords: "usuario rol",
    roles: ["owner", "admin"],
  },
  {
    label: "Auditoría",
    path: "/audit",
    icon: "policy",
    keywords: "audit log",
    roles: ["owner", "admin"],
  },
  {
    label: "Configuración",
    path: "/settings",
    icon: "settings",
    keywords: "configuración setting",
    roles: ["owner", "admin"],
  },
];

/* ─── Debounce hook ─── */
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── Component ─── */
export function CommandSearch() {
  const trpc = useTRPC();
  const router = useRouter();
  const { profile } = useCurrentUser();
  const userRole = profile?.role ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const hasEntityQuery = debouncedQuery.length >= 2;

  // ── tRPC entity searches (only when open + query >= 2 chars) ──
  const { data: products } = useQuery({
    ...trpc.catalog.listProducts.queryOptions(
      { search: debouncedQuery, limit: 5 },
      { staleTime: 10_000 },
    ),
    enabled: open && hasEntityQuery,
  });

  const { data: customers } = useQuery({
    ...trpc.sales.listCustomers.queryOptions(
      { limit: 20 },
      { staleTime: 10_000 },
    ),
    enabled: open && hasEntityQuery,
  });

  const { data: orders } = useQuery({
    ...trpc.sales.listOrders.queryOptions({ limit: 20 }, { staleTime: 10_000 }),
    enabled: open && hasEntityQuery,
  });

  // ── Build results ──
  const routeResults =
    query.length >= 1
      ? ROUTES.filter((r) => {
          if (r.roles && !hasRole(userRole, r.roles)) return false;
          const q = query.toLowerCase();
          return r.label.toLowerCase().includes(q) || r.keywords.includes(q);
        }).slice(0, 5)
      : [];

  const productResults =
    hasEntityQuery && products?.items ? products.items.slice(0, 5) : [];

  const customerResults =
    hasEntityQuery && customers
      ? (Array.isArray(customers) ? customers : [])
          .filter((c) => {
            const q = debouncedQuery.toLowerCase();
            if (c.name.toLowerCase().includes(q)) return true;
            if (c.email?.toLowerCase().includes(q)) return true;
            if (c.phone?.includes(debouncedQuery)) return true;
            return false;
          })
          .slice(0, 5)
      : [];

  const orderResults =
    hasEntityQuery && orders
      ? (Array.isArray(orders) ? orders : [])
          .filter((o) =>
            o.orderNumber.toLowerCase().includes(debouncedQuery.toLowerCase()),
          )
          .slice(0, 5)
      : [];

  // ── Flat list for keyboard navigation ──
  interface ResultItem {
    type: "route" | "product" | "customer" | "order";
    id: string;
    label: string;
    sub: string;
    icon: string;
    path: string;
  }

  const allResults: ResultItem[] = [
    ...routeResults.map((r) => ({
      type: "route" as const,
      id: r.path,
      label: r.label,
      sub: r.path,
      icon: r.icon,
      path: r.path,
    })),
    ...productResults.map((p) => ({
      type: "product" as const,
      id: p.id,
      label: p.name,
      sub: p.sku,
      icon: "inventory_2",
      path: `/catalog/${p.id}`,
    })),
    ...customerResults.map((c) => ({
      type: "customer" as const,
      id: c.id,
      label: c.name,
      sub: c.phone ?? c.email ?? "—",
      icon: "person",
      path: `/customers`,
    })),
    ...orderResults.map((o) => ({
      type: "order" as const,
      id: o.id,
      label: o.orderNumber,
      sub: `$${Number(o.total).toFixed(2)}`,
      icon: "receipt_long",
      path: `/orders`,
    })),
  ];

  // ── Handlers ──
  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handleSelect = useCallback(
    (item: ResultItem) => {
      handleClose();
      router.push(item.path);
    },
    [handleClose, router],
  );

  // ── Global ⌘K / Ctrl+K shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) handleClose();
        else handleOpen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose, handleOpen]);

  // ── Outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  // ── Keyboard navigation ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex]);
    }
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ── Section header helper ──
  const SectionHeader = ({ icon, label }: { icon: string; label: string }) => (
    <div className="text-muted-foreground flex items-center gap-2 px-3 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase">
      <span className="material-symbols-outlined text-xs">{icon}</span>
      {label}
    </div>
  );

  // ── Compute flat index for each item ──
  let flatIndex = 0;
  const getIndex = () => flatIndex++;

  return (
    <>
      {/* ── Dormant trigger (pill) ── */}
      <button
        onClick={handleOpen}
        className={cn(
          "bg-secondary hover:bg-accent text-muted-foreground hidden h-9 items-center gap-2 rounded-lg px-4 text-sm transition-all sm:flex",
          "w-64 justify-between",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">search</span>
          <span className="text-muted-foreground/70 text-xs">Buscar...</span>
        </div>
        <kbd className="bg-background text-muted-foreground/50 pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      {/* ── Mobile trigger ── */}
      <button
        onClick={handleOpen}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-11 items-center justify-center rounded-lg transition-colors sm:hidden"
        aria-label="Buscar"
      >
        <span className="material-symbols-outlined text-xl">search</span>
      </button>

      {/* ── Command palette overlay ── */}
      {open && (
        <div className="fixed inset-0 z-100 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm sm:pt-[20vh]">
          <div
            ref={containerRef}
            className="border-border bg-card mx-4 w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
          >
            {/* Input */}
            <div className="border-border flex items-center gap-3 border-b px-4">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar páginas, productos, clientes, pedidos..."
                className="text-foreground placeholder:text-muted-foreground h-12 w-full border-none bg-transparent text-sm outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="bg-secondary text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {allResults.length === 0 && query.length > 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <span className="material-symbols-outlined text-muted-foreground text-3xl">
                    search_off
                  </span>
                  <p className="text-muted-foreground text-sm">
                    No se encontraron resultados
                  </p>
                  <p className="text-muted-foreground/60 text-xs">
                    Intenta con otro término de búsqueda
                  </p>
                </div>
              ) : allResults.length === 0 && query.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <span className="material-symbols-outlined text-muted-foreground/50 text-3xl">
                    manage_search
                  </span>
                  <p className="text-muted-foreground text-sm">
                    Escribe para buscar en todo el sistema
                  </p>
                  <p className="text-muted-foreground/60 text-xs">
                    Páginas, productos, clientes, pedidos...
                  </p>
                </div>
              ) : (
                <>
                  {/* Route results */}
                  {routeResults.length > 0 && (
                    <>
                      <SectionHeader icon="web" label="Páginas" />
                      {routeResults.map((r) => {
                        const idx = getIndex();
                        return (
                          <button
                            key={r.path}
                            onClick={() =>
                              handleSelect({
                                type: "route",
                                id: r.path,
                                label: r.label,
                                sub: r.path,
                                icon: r.icon,
                                path: r.path,
                              })
                            }
                            className={cn(
                              "flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              idx === selectedIndex
                                ? "bg-accent text-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                          >
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              {r.icon}
                            </span>
                            <span className="font-medium">{r.label}</span>
                            <span className="text-muted-foreground ml-auto text-xs">
                              {r.path}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Product results */}
                  {productResults.length > 0 && (
                    <>
                      <SectionHeader icon="inventory_2" label="Productos" />
                      {productResults.map((p) => {
                        const idx = getIndex();
                        return (
                          <button
                            key={p.id}
                            onClick={() =>
                              handleSelect({
                                type: "product",
                                id: p.id,
                                label: p.name,
                                sub: p.sku,
                                icon: "inventory_2",
                                path: `/catalog/${p.id}`,
                              })
                            }
                            className={cn(
                              "flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              idx === selectedIndex
                                ? "bg-accent text-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                          >
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              inventory_2
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{p.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {p.sku}
                              </p>
                            </div>
                            {p.status !== "draft" && (
                              <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-bold">
                                {p.status}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Customer results */}
                  {customerResults.length > 0 && (
                    <>
                      <SectionHeader icon="person" label="Clientes" />
                      {customerResults.map((c) => {
                        const idx = getIndex();
                        return (
                          <button
                            key={c.id}
                            onClick={() =>
                              handleSelect({
                                type: "customer",
                                id: c.id,
                                label: c.name,
                                sub: c.phone ?? c.email ?? "—",
                                icon: "person",
                                path: `/customers`,
                              })
                            }
                            className={cn(
                              "flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              idx === selectedIndex
                                ? "bg-accent text-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                          >
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              person
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {c.phone ?? c.email ?? "—"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Order results */}
                  {orderResults.length > 0 && (
                    <>
                      <SectionHeader icon="receipt_long" label="Pedidos" />
                      {orderResults.map((o) => {
                        const idx = getIndex();
                        return (
                          <button
                            key={o.id}
                            onClick={() =>
                              handleSelect({
                                type: "order",
                                id: o.id,
                                label: o.orderNumber,
                                sub: `$${Number(o.total).toFixed(2)}`,
                                icon: "receipt_long",
                                path: `/orders`,
                              })
                            }
                            className={cn(
                              "flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              idx === selectedIndex
                                ? "bg-accent text-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                          >
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              receipt_long
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {o.orderNumber}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {o.status} · ${Number(o.total).toFixed(2)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer hints */}
            <div className="border-border flex items-center justify-between border-t px-4 py-2">
              <div className="text-muted-foreground/50 flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded border px-1 py-0.5 font-mono">
                    ↑
                  </kbd>
                  <kbd className="bg-secondary rounded border px-1 py-0.5 font-mono">
                    ↓
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded border px-1 py-0.5 font-mono">
                    ↵
                  </kbd>
                  seleccionar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded border px-1 py-0.5 font-mono">
                    ESC
                  </kbd>
                  cerrar
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
