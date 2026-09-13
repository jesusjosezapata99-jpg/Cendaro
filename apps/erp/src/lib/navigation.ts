/**
 * Single source of truth for the rail navigation (PLAN-2026-09-MIDDAY-REDESIGN
 * §5.8.3, T2.1). 9 top-level parents; some navigate directly (`href` set),
 * others only group children and resolve to the first visible child's href.
 *
 * Role lists live in `NAV_ROLE_RULES` (`@cendaro/validators`) so this file,
 * `search.global` (T2.11) and `proxy.ts`'s redirect allowlist all agree on
 * who sees what — never inline a `roles: UserRole[]` array here.
 */
import type { IconName } from "@cendaro/ui/icons";
import type { UserRole } from "@cendaro/validators";
import { NAV_ROLE_RULES } from "@cendaro/validators";

export interface NavChild {
  label: string;
  href: string;
  roles?: readonly UserRole[];
  kind: "link" | "create";
}

export interface NavParent {
  id: string;
  label: string;
  icon: IconName;
  /** Set when the parent itself is a direct link. Omitted when it only groups children. */
  href?: string;
  roles?: readonly UserRole[];
  children?: NavChild[];
}

export const NAV_ITEMS: NavParent[] = [
  {
    id: "overview",
    label: "Resumen",
    icon: "Overview",
    href: "/dashboard",
  },
  {
    id: "pos",
    label: "Punto de venta",
    icon: "PointOfSale",
    href: "/pos",
    roles: NAV_ROLE_RULES.pos,
  },
  {
    id: "sales",
    label: "Ventas",
    icon: "ReceiptLong",
    children: [
      { label: "Pedidos", href: "/orders", kind: "link" },
      { label: "Cotizaciones", href: "/quotes", kind: "link" },
      {
        label: "Notas de entrega",
        href: "/delivery-notes",
        roles: NAV_ROLE_RULES.deliveryNotes,
        kind: "link",
      },
      {
        label: "Facturas",
        href: "/invoices",
        roles: NAV_ROLE_RULES.invoices,
        kind: "link",
      },
      {
        label: "Vendedores",
        href: "/vendors",
        roles: NAV_ROLE_RULES.vendors,
        kind: "link",
      },
      {
        label: "Nuevo pedido",
        href: "/orders?createOrder=true",
        roles: NAV_ROLE_RULES.createOrder,
        kind: "create",
      },
    ],
  },
  {
    id: "customers",
    label: "Clientes",
    icon: "Groups",
    href: "/customers",
    children: [
      { label: "Clientes", href: "/customers", kind: "link" },
      {
        label: "Nuevo cliente",
        href: "/customers?createCustomer=true",
        roles: NAV_ROLE_RULES.createCustomer,
        kind: "create",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catálogo",
    icon: "Category",
    href: "/catalog",
    children: [
      { label: "Productos", href: "/catalog", kind: "link" },
      { label: "Categorías", href: "/catalog/categories", kind: "link" },
      { label: "Marcas", href: "/catalog/brands", kind: "link" },
      { label: "Proveedores", href: "/catalog/suppliers", kind: "link" },
      {
        label: "Precios",
        href: "/pricing",
        roles: NAV_ROLE_RULES.pricing,
        kind: "link",
      },
      {
        label: "Importar",
        href: "/catalog/import",
        roles: NAV_ROLE_RULES.catalogImport,
        kind: "link",
      },
      {
        label: "Nuevo producto",
        href: "/catalog?createProduct=true",
        roles: NAV_ROLE_RULES.createProduct,
        kind: "create",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: "Inventory",
    href: "/inventory",
    roles: NAV_ROLE_RULES.inventory,
    children: [
      { label: "Almacenes", href: "/inventory", kind: "link" },
      {
        label: "Contenedores",
        href: "/containers",
        roles: NAV_ROLE_RULES.containers,
        kind: "link",
      },
    ],
  },
  {
    id: "finance",
    label: "Finanzas",
    icon: "AccountBalance",
    children: [
      {
        label: "Pagos",
        href: "/payments",
        roles: NAV_ROLE_RULES.payments,
        kind: "link",
      },
      {
        label: "CxC",
        href: "/accounts-receivable",
        roles: NAV_ROLE_RULES.accountsReceivable,
        kind: "link",
      },
      {
        label: "Cierre de caja",
        href: "/cash-closure",
        roles: NAV_ROLE_RULES.cashClosure,
        kind: "link",
      },
      {
        label: "Tasas de cambio",
        href: "/rates",
        roles: NAV_ROLE_RULES.rates,
        kind: "link",
      },
    ],
  },
  {
    id: "channels",
    label: "Canales",
    icon: "Storefront",
    children: [
      {
        label: "Mercado Libre",
        href: "/marketplace",
        roles: NAV_ROLE_RULES.marketplace,
        kind: "link",
      },
      {
        label: "WhatsApp",
        href: "/whatsapp",
        roles: NAV_ROLE_RULES.whatsapp,
        kind: "link",
      },
    ],
  },
  {
    id: "settings",
    label: "Configuración",
    icon: "Settings",
    children: [
      {
        label: "General",
        href: "/settings",
        roles: NAV_ROLE_RULES.settings,
        kind: "link",
      },
      {
        label: "Usuarios",
        href: "/users",
        roles: NAV_ROLE_RULES.users,
        kind: "link",
      },
      {
        label: "Auditoría",
        href: "/audit",
        roles: NAV_ROLE_RULES.audit,
        kind: "link",
      },
      {
        label: "Alertas",
        href: "/alerts",
        roles: NAV_ROLE_RULES.alerts,
        kind: "link",
      },
    ],
  },
];

function isVisible(
  roles: readonly UserRole[] | undefined,
  role: UserRole | null,
) {
  if (!roles) return true;
  if (!role) return false;
  return roles.includes(role);
}

/** Parent + only its role-visible children, filtering out parents left with nothing to show. */
export interface VisibleNavParent extends Omit<NavParent, "children"> {
  children?: NavChild[];
  /** Resolved href: the parent's own `href`, or its first visible child's. */
  resolvedHref: string;
}

export function getVisibleNav(role: UserRole | null): VisibleNavParent[] {
  const result: VisibleNavParent[] = [];

  for (const parent of NAV_ITEMS) {
    if (!isVisible(parent.roles, role)) continue;

    const visibleChildren = parent.children?.filter((child) =>
      isVisible(child.roles, role),
    );

    if (parent.children && (!visibleChildren || visibleChildren.length === 0)) {
      continue;
    }

    const resolvedHref = parent.href ?? visibleChildren?.[0]?.href;
    if (!resolvedHref) continue;

    result.push({ ...parent, children: visibleChildren, resolvedHref });
  }

  return result;
}

/** Parent is active if `pathname` starts with the base path of any of its children (or its own href). */
export function isParentActive(
  parent: Pick<NavParent, "href" | "children">,
  pathname: string,
): boolean {
  if (
    parent.href &&
    (pathname === parent.href || pathname.startsWith(parent.href + "/"))
  ) {
    return true;
  }
  return (parent.children ?? []).some((child) =>
    isChildActive(child, pathname),
  );
}

/** Child is active on an exact match or a nested route, ignoring its own query string. */
export function isChildActive(
  child: Pick<NavChild, "href">,
  pathname: string,
): boolean {
  const base = child.href.split("?", 1)[0] ?? child.href;
  return pathname === base || pathname.startsWith(base + "/");
}
