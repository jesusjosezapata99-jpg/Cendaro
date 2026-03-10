"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { useCurrentUser } from "~/hooks/use-current-user";

interface TopBarProps {
  onToggleSidebar: () => void;
}

const SEARCH_ROUTES = [
  { label: "Dashboard", path: "/dashboard", keywords: "inicio panel kpi" },
  { label: "Catálogo", path: "/catalog", keywords: "productos sku inventario" },
  { label: "Marcas", path: "/catalog/brands", keywords: "brand marca" },
  { label: "Categorías", path: "/catalog/categories", keywords: "categoría tree" },
  { label: "Proveedores", path: "/catalog/suppliers", keywords: "proveedor supplier" },
  { label: "Inventario", path: "/inventory", keywords: "stock almacén warehouse" },
  { label: "Contenedores", path: "/containers", keywords: "container importación fob" },
  { label: "Precios", path: "/pricing", keywords: "repricing precio" },
  { label: "Tasas de Cambio", path: "/rates", keywords: "tasa bcv dólar bolívar" },
  { label: "Órdenes", path: "/orders", keywords: "pedido venta order" },
  { label: "Clientes", path: "/customers", keywords: "cliente customer" },
  { label: "Vendedores", path: "/vendors", keywords: "vendedor comisión" },
  { label: "Marketplace", path: "/marketplace", keywords: "mercadolibre ml" },
  { label: "WhatsApp", path: "/whatsapp", keywords: "whatsapp chat" },
  { label: "Pagos", path: "/payments", keywords: "pago cobro payment" },
  { label: "Cierre de Caja", path: "/cash-closure", keywords: "caja cierre cash" },
  { label: "CxC", path: "/accounts-receivable", keywords: "cuenta cobrar receivable" },
  { label: "Alertas", path: "/alerts", keywords: "alerta warning" },
  { label: "Usuarios", path: "/users", keywords: "usuario rol" },
  { label: "Auditoría", path: "/audit", keywords: "audit log" },
  { label: "Configuración", path: "/settings", keywords: "configuración setting" },
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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.length >= 2
    ? SEARCH_ROUTES.filter((r) =>
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Toggle sidebar"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>

        {/* Global search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar módulos, páginas..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="h-9 w-64 rounded-lg border-none bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          {showResults && filtered.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {filtered.map((r) => (
                <button
                  key={r.path}
                  onClick={() => handleNav(r.path)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="material-symbols-outlined text-base text-muted-foreground">arrow_forward</span>
                  <span className="font-medium">{r.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.path}</span>
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
          className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-xl">notifications</span>
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {loading ? "…" : initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-foreground">
                {loading ? "Cargando…" : (profile?.fullName ?? "Usuario")}
              </p>
              <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
            </div>
            <span className="material-symbols-outlined hidden text-base text-muted-foreground sm:block">
              expand_more
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => { setShowUserMenu(false); router.push("/settings"); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/50"
              >
                <span className="material-symbols-outlined text-base text-muted-foreground">settings</span>
                Configuración
              </button>
              <button
                onClick={() => { setShowUserMenu(false); router.push("/audit"); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/50"
              >
                <span className="material-symbols-outlined text-base text-muted-foreground">history</span>
                Log de Auditoría
              </button>
              <div className="my-1 h-px bg-border" />
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
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-accent/50"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
