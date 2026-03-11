"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "~/hooks/use-current-user";
import { ThemeToggle } from "./theme-toggle";

interface TopBarProps {
  onToggleSidebar: () => void;
}

const SEARCH_ROUTES = [
  { label: "Dashboard", path: "/dashboard", keywords: "inicio panel kpi" },
  { label: "Catálogo", path: "/catalog", keywords: "productos sku inventario" },
  { label: "Marcas", path: "/catalog/brands", keywords: "brand marca" },
  {
    label: "Categorías",
    path: "/catalog/categories",
    keywords: "categoría tree",
  },
  {
    label: "Proveedores",
    path: "/catalog/suppliers",
    keywords: "proveedor supplier",
  },
  {
    label: "Inventario",
    path: "/inventory",
    keywords: "stock almacén warehouse",
  },
  {
    label: "Contenedores",
    path: "/containers",
    keywords: "container importación fob",
  },
  { label: "Precios", path: "/pricing", keywords: "repricing precio" },
  {
    label: "Tasas de Cambio",
    path: "/rates",
    keywords: "tasa bcv dólar bolívar",
  },
  { label: "Órdenes", path: "/orders", keywords: "pedido venta order" },
  {
    label: "Cotizaciones",
    path: "/quotes",
    keywords: "cotización quote presupuesto",
  },
  {
    label: "Notas de Entrega",
    path: "/delivery-notes",
    keywords: "nota entrega delivery despacho",
  },
  {
    label: "Facturas",
    path: "/invoices",
    keywords: "factura invoice documento",
  },
  { label: "Clientes", path: "/customers", keywords: "cliente customer" },
  { label: "Vendedores", path: "/vendors", keywords: "vendedor comisión" },
  { label: "Marketplace", path: "/marketplace", keywords: "mercadolibre ml" },
  { label: "WhatsApp", path: "/whatsapp", keywords: "whatsapp chat" },
  { label: "Pagos", path: "/payments", keywords: "pago cobro payment" },
  {
    label: "Cierre de Caja",
    path: "/cash-closure",
    keywords: "caja cierre cash",
  },
  {
    label: "CxC",
    path: "/accounts-receivable",
    keywords: "cuenta cobrar receivable",
  },
  { label: "Alertas", path: "/alerts", keywords: "alerta warning" },
  { label: "Usuarios", path: "/users", keywords: "usuario rol" },
  { label: "Auditoría", path: "/audit", keywords: "audit log" },
  {
    label: "Configuración",
    path: "/settings",
    keywords: "configuración setting",
  },
];

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { profile, loading, initials, roleLabel } = useCurrentUser();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowResults(false);
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered =
    search.length >= 2
      ? SEARCH_ROUTES.filter(
          (r) =>
            r.label.toLowerCase().includes(search.toLowerCase()) ||
            r.keywords.includes(search.toLowerCase()),
        ).slice(0, 6)
      : [];

  const handleNav = (path: string) => {
    setSearch("");
    setShowResults(false);
    router.push(path);
  };

  return (
    <header className="border-border bg-card flex h-14 shrink-0 items-center justify-between border-b px-4 lg:px-6">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>

        {/* Global search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <span className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar módulos, páginas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-ring/20 h-9 w-64 rounded-lg border-none pr-4 pl-10 text-sm focus:ring-2 focus:outline-none"
          />
          {showResults && filtered.length > 0 && (
            <div className="border-border bg-card absolute top-full left-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border shadow-lg">
              {filtered.map((r) => (
                <button
                  key={r.path}
                  onClick={() => handleNav(r.path)}
                  className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-muted-foreground text-base">
                    arrow_forward
                  </span>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {r.path}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Notifications → link to alerts */}
        <button
          onClick={() => router.push("/alerts")}
          className="text-muted-foreground hover:bg-accent hover:text-foreground relative flex size-9 items-center justify-center rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-xl">
            notifications
          </span>
          <span className="bg-destructive ring-card absolute top-1.5 right-1.5 size-2 rounded-full ring-2" />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div className="bg-border mx-1 h-6 w-px" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((o) => !o)}
            className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-bold">
              {loading ? "…" : initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-foreground text-xs font-semibold">
                {loading ? "Cargando…" : (profile?.fullName ?? "Usuario")}
              </p>
              <p className="text-muted-foreground text-[10px]">{roleLabel}</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground hidden text-base sm:block">
              expand_more
            </span>
          </button>

          {showUserMenu && (
            <div className="border-border bg-card absolute top-full right-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border shadow-lg">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/settings");
                }}
                className="text-foreground hover:bg-accent/50 flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              >
                <span className="material-symbols-outlined text-muted-foreground text-base">
                  settings
                </span>
                Configuración
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/audit");
                }}
                className="text-foreground hover:bg-accent/50 flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              >
                <span className="material-symbols-outlined text-muted-foreground text-base">
                  history
                </span>
                Log de Auditoría
              </button>
              <div className="bg-border my-1 h-px" />
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } catch {
                    // fallback: redirect even if server call fails
                  }
                  window.location.href = "/login";
                }}
                className="hover:bg-accent/50 flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-base">
                  logout
                </span>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
