"use client";

import { useEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@cendaro/validators";
import { cn } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { NavChild, VisibleNavParent } from "~/lib/navigation";
import { getVisibleNav, isChildActive, isParentActive } from "~/lib/navigation";

/**
 * PLAN-2026-09-MIDDAY-REDESIGN §5.7 M-03…M-07, §5.8.3 (T2.2).
 *
 * Each item is a `relative h-10` row with 3 layered spans (pill background,
 * icon box, label) plus an optional stagger-animated children list. The
 * label is always mounted and toggled via `opacity`/`pointer-events` rather
 * than conditionally rendered — conditional mounting would kill the fade
 * transition M-04 asks for, since a removed node can't animate its own
 * removal. Documented deviation from the plan's literal "render condicional".
 */

const PARENT_TRANSITION =
  "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]";

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn("nav-pending", pending && "nav-pending--active")}
    />
  );
}

interface MainMenuProps {
  role: UserRole | null;
  /** Whether the rail is in its hover/focus-expanded (240px) state. */
  expanded: boolean;
  /** Called after a real navigation (parent or child link) — e.g. to close the mobile Sheet (T2.5). */
  onNavigate?: () => void;
}

export function MainMenu({ role, expanded, onNavigate }: MainMenuProps) {
  const pathname = usePathname();
  const items = getVisibleNav(role);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    // M-07: "el hijo expandido se resetea cuando el riel colapsa". While
    // expanding, auto-open whichever parent matches the current route.
    if (!expanded) {
      setOpenId(null);
      return;
    }
    const active = items.find(
      (item) => item.children?.length && isParentActive(item, pathname),
    );
    setOpenId(active?.id ?? null);
    // items is derived fresh from (role, pathname) each render; only the
    // rail's own expand state and the route should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, pathname]);

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item) => (
        <MenuItem
          key={item.id}
          item={item}
          pathname={pathname}
          expanded={expanded}
          isOpen={openId === item.id}
          onToggle={() =>
            setOpenId((cur) => (cur === item.id ? null : item.id))
          }
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function MenuItem({
  item,
  pathname,
  expanded,
  isOpen,
  onToggle,
  onNavigate,
}: {
  item: VisibleNavParent;
  pathname: string;
  expanded: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const active = isParentActive(item, pathname);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;

  const visual = (
    <>
      {/* M-03 — item background pill */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 left-3.75 h-10",
          PARENT_TRANSITION,
          expanded ? "w-[calc(100%-30px)]" : "w-10",
          active && "bg-nav-active border-line border",
        )}
      />
      {/* Icon box: absolute top-0 left-3.75 w-10 h-10, size 20 */}
      <span className="absolute top-0 left-3.75 flex h-10 w-10 items-center justify-center">
        <Icon
          name={item.icon}
          className={cn("size-5", active ? "text-foreground" : "text-nav-icon")}
        />
      </span>
      {/* M-04 — label, always mounted so opacity can transition */}
      <span
        className={cn(
          "absolute top-0 right-1 left-13.75 flex h-10 items-center gap-2 text-sm font-medium",
          "transition-opacity duration-200 ease-in-out",
          expanded ? "opacity-100" : "pointer-events-none opacity-0",
          active ? "text-foreground" : "text-nav-label",
        )}
      >
        <span className="truncate">{item.label}</span>
        <PendingDot />
      </span>
    </>
  );

  return (
    <li className="relative">
      {item.href ? (
        <Link
          href={item.href}
          className="relative block h-10"
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {visual}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="relative block h-10 w-full text-left"
          aria-expanded={isOpen}
        >
          {visual}
        </button>
      )}

      {/* M-07 — chevron, separate control layered on top (never nested
          inside the Link/button above — avoids interactive-in-interactive) */}
      {expanded && hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          className="absolute top-1 right-3 z-10 flex h-8 w-8 items-center justify-center"
          aria-expanded={isOpen}
          aria-label={
            isOpen ? `Contraer ${item.label}` : `Expandir ${item.label}`
          }
        >
          <Icons.ExpandMore
            className={cn(
              "text-nav-label size-4 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
      )}

      {hasChildren && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: isOpen && expanded ? "24rem" : "0px",
            marginTop: isOpen && expanded ? "0.25rem" : "0px",
          }}
        >
          {children.map((child, index) => (
            <ChildRow
              key={child.href}
              child={child}
              index={index}
              open={isOpen && expanded}
              active={isChildActive(child, pathname)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function ChildRow({
  child,
  index,
  open,
  active,
  onNavigate,
}: {
  child: NavChild;
  index: number;
  open: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  // M-06: stagger 40 + i·20ms opening, i·20ms closing.
  const delay = open ? 40 + index * 20 : index * 20;
  return (
    <Link
      href={child.href}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "border-line mr-3.75 ml-8.75 flex h-8 items-center border-l pl-3 text-xs font-medium",
        "transition-all duration-200 ease-out",
        open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
        active ? "text-foreground" : "text-nav-child",
      )}
      tabIndex={open ? 0 : -1}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="truncate">{child.label}</span>
    </Link>
  );
}
