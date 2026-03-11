"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { UserRole } from "@cendaro/validators";
import { cn } from "@cendaro/ui";

import { hasRole } from "~/components/role-guard";
import { useCurrentUser } from "~/hooks/use-current-user";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  /** Roles that can see this item. If omitted, all roles can see it. */
  roles?: UserRole[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/catalog", label: "Catálogo", icon: "inventory_2" },
      {
        href: "/inventory",
        label: "Inventario",
        icon: "warehouse",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/containers",
        label: "Contenedores",
        icon: "package_2",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/pricing",
        label: "Precios",
        icon: "sell",
        roles: ["owner", "admin", "supervisor"],
      },
    ],
  },
  {
    title: "Ventas",
    items: [
      {
        href: "/pos",
        label: "Punto de Venta",
        icon: "point_of_sale",
        roles: ["owner", "admin", "supervisor", "employee"],
      },
      { href: "/orders", label: "Pedidos", icon: "list_alt" },
      { href: "/quotes", label: "Cotizaciones", icon: "request_quote" },
      {
        href: "/delivery-notes",
        label: "Notas de Entrega",
        icon: "local_shipping",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/invoices",
        label: "Facturas",
        icon: "description",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/vendors",
        label: "Vendedores",
        icon: "group",
        roles: ["owner", "admin", "supervisor"],
      },
      { href: "/customers", label: "Clientes", icon: "person" },
    ],
  },
  {
    title: "Canales",
    items: [
      {
        href: "/marketplace",
        label: "Mercado Libre",
        icon: "storefront",
        roles: ["owner", "admin", "supervisor", "marketing"],
      },
      {
        href: "/whatsapp",
        label: "WhatsApp",
        icon: "chat",
        roles: ["owner", "admin", "supervisor", "employee"],
      },
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        href: "/payments",
        label: "Pagos",
        icon: "payments",
        roles: ["owner", "admin", "supervisor", "employee"],
      },
      {
        href: "/cash-closure",
        label: "Cierre de Caja",
        icon: "lock_clock",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/accounts-receivable",
        label: "CxC",
        icon: "receipt_long",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/rates",
        label: "Tasas de Cambio",
        icon: "currency_exchange",
        roles: ["owner", "admin", "supervisor"],
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        href: "/alerts",
        label: "Alertas",
        icon: "notifications_active",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/users",
        label: "Usuarios",
        icon: "manage_accounts",
        roles: ["owner", "admin"],
      },
      {
        href: "/audit",
        label: "Auditoría",
        icon: "policy",
        roles: ["owner", "admin"],
      },
      {
        href: "/settings",
        label: "Configuración",
        icon: "settings",
        roles: ["owner", "admin"],
      },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, initials, roleLabel } = useCurrentUser();

  const userRole = profile?.role ?? null;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="border-sidebar-border flex h-14 items-center justify-between border-b px-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <span className="material-symbols-outlined text-lg">
                rocket_launch
              </span>
            </div>
            <div>
              <h1 className="text-sidebar-primary text-sm font-bold tracking-tight">
                Cendaro
              </h1>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                ERP Omnicanal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-sidebar-accent flex size-8 items-center justify-center rounded-lg lg:hidden"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => {
            // Filter items by role
            const visibleItems = section.items.filter(
              (item) => !item.roles || hasRole(userRole, item.roles),
            );
            // Hide entire section if no items visible
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="mb-5">
                <h2 className="text-muted-foreground mb-2 px-3 text-[10px] font-bold tracking-widest uppercase">
                  {section.title}
                </h2>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                          )}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer — User */}
        <div className="border-sidebar-border border-t px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-bold">
              {loading ? "…" : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground truncate text-sm font-medium">
                {loading ? "Cargando…" : (profile?.fullName ?? "Usuario")}
              </p>
              <p className="text-muted-foreground text-xs">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
