"use client";

import { usePathname, useRouter } from "next/navigation";

import type { IconName } from "@cendaro/ui/icons";
import type { UserRole } from "@cendaro/validators";
import { cn } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import { NavLink } from "~/components/nav-link";
import { hasRole } from "~/components/role-guard";
import { WorkspaceSwitcher } from "~/components/workspace-switcher";
import { useCurrentUser } from "~/hooks/use-current-user";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  /** Roles that can see this item. If omitted, all roles can see it. */
  roles?: UserRole[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "Dashboard" }],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/catalog", label: "Catálogo", icon: "Inventory2" },
      {
        href: "/inventory",
        label: "Inventario",
        icon: "Warehouse",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/containers",
        label: "Contenedores",
        icon: "Package2",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/pricing",
        label: "Precios",
        icon: "Sell",
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
        icon: "PointOfSale",
        roles: ["owner", "admin", "supervisor", "employee"],
      },
      { href: "/orders", label: "Pedidos", icon: "ListAlt" },
      { href: "/quotes", label: "Cotizaciones", icon: "RequestQuote" },
      {
        href: "/delivery-notes",
        label: "Notas de Entrega",
        icon: "LocalShipping",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/invoices",
        label: "Facturas",
        icon: "Description",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/vendors",
        label: "Vendedores",
        icon: "Group",
        roles: ["owner", "admin", "supervisor"],
      },
      { href: "/customers", label: "Clientes", icon: "Person" },
    ],
  },
  {
    title: "Canales",
    items: [
      {
        href: "/marketplace",
        label: "Mercado Libre",
        icon: "Storefront",
        roles: ["owner", "admin", "supervisor", "marketing"],
      },
      {
        href: "/whatsapp",
        label: "WhatsApp",
        icon: "Chat",
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
        icon: "Payments",
        roles: ["owner", "admin", "supervisor", "employee"],
      },
      {
        href: "/cash-closure",
        label: "Cierre de Caja",
        icon: "LockClock",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/accounts-receivable",
        label: "CxC",
        icon: "ReceiptLong",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/rates",
        label: "Tasas de Cambio",
        icon: "CurrencyExchange",
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
        icon: "NotificationsActive",
        roles: ["owner", "admin", "supervisor"],
      },
      {
        href: "/users",
        label: "Usuarios",
        icon: "ManageAccounts",
        roles: ["owner", "admin"],
      },
      {
        href: "/audit",
        label: "Auditoría",
        icon: "Policy",
        roles: ["owner", "admin"],
      },
      {
        href: "/settings",
        label: "Configuración",
        icon: "Settings",
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
          "border-sidebar-border bg-background text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0",
          /* iOS safe-area: pad left for landscape notch */
          "safe-pl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Workspace Switcher */}
        <div className="border-sidebar-border safe-pt flex items-center justify-between border-b px-3 py-2">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher />
          </div>
          {/* Close — 44px touch target (mobile only) */}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-sidebar-accent flex size-11 shrink-0 items-center justify-center rounded-lg lg:hidden"
            aria-label="Cerrar menú lateral"
          >
            <Icons.Close className="size-5" />
          </button>
        </div>

        {/* Navigation — overscroll containment for iOS */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {navSections.map((section) => {
            // Filter items by role
            const visibleItems = section.items.filter(
              (item) => !item.roles || hasRole(userRole, item.roles),
            );
            // Hide entire section if no items visible
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="mb-5">
                <h2 className="text-muted-foreground mb-2 px-3 text-[10px] font-medium tracking-widest uppercase">
                  {section.title}
                </h2>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <NavLink
                          href={item.href}
                          active={isActive}
                          onClick={onClose}
                        >
                          <Icon name={item.icon} className="size-5" />
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer — User — with safe-area-inset-bottom */}
        <div className="border-sidebar-border safe-pb border-t px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-medium">
              {loading ? "…" : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground truncate text-sm font-medium">
                {loading ? "Cargando…" : (profile?.fullName ?? "Usuario")}
              </p>
              <p className="text-muted-foreground text-xs">{roleLabel}</p>
            </div>
            {/* Logout — 44px touch target */}
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-destructive flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <Icons.Logout className="size-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
