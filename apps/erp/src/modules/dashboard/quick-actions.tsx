"use client";

import Link from "next/link";

import type { IconName } from "@cendaro/ui/icons";
import type { UserRole } from "@cendaro/validators";
import { Icon } from "@cendaro/ui/icons";
import { NAV_ROLE_RULES } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";

interface QuickAction {
  label: string;
  icon: IconName;
  href: string;
  roles: readonly UserRole[];
}

const ACTIONS: QuickAction[] = [
  {
    label: "Nuevo pedido",
    icon: "Add",
    href: "/orders?createOrder=true",
    roles: NAV_ROLE_RULES.createOrder,
  },
  {
    label: "Nueva cotización",
    icon: "RequestQuote",
    href: "/quotes?createQuote=true",
    // quotes.create is gated by orders.create on the server.
    roles: NAV_ROLE_RULES.createOrder,
  },
  {
    label: "Registrar pago",
    icon: "Payments",
    href: "/payments?registerPayment=true",
    roles: NAV_ROLE_RULES.payments,
  },
  {
    label: "Abrir POS",
    icon: "PointOfSale",
    href: "/pos",
    roles: NAV_ROLE_RULES.pos,
  },
];

/** Quick-action chips (PLAN-2026-09-DESIGN-SYSTEM M-12, §T3.3). */
export function QuickActions() {
  const { profile } = useCurrentUser();
  const role = profile?.role;

  const visible = ACTIONS.filter(
    (action) => role && action.roles.includes(role),
  );
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3 py-8">
      {visible.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="group/chip border-line hover:border-line-hover flex items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors duration-300"
        >
          <Icon
            name={action.icon}
            className="text-muted-foreground/40 group-hover/chip:text-foreground size-3.25 transition-colors duration-300"
          />
          <span className="text-muted-foreground/60 group-hover/chip:text-foreground transition-colors duration-300">
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
