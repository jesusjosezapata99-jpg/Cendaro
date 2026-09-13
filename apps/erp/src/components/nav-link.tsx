"use client";

import Link, { useLinkStatus } from "next/link";

import { cn } from "@cendaro/ui";

/**
 * Subtle pending indicator for sidebar navigation (Next.js `useLinkStatus`).
 *
 * Official debounced pattern: the dot starts invisible and only fades in
 * after 100 ms — navigations served by an already-prefetched App Shell are
 * instant and never flash feedback, while slow ones (first visit, cold
 * dynamic segment) get immediate "something is happening" feedback.
 * Must be rendered as a descendant of a <Link>.
 */
function PendingDot() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn("nav-pending", pending && "nav-pending--active")}
    />
  );
}

interface NavLinkProps {
  href: string;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Sidebar navigation link with inline pending feedback.
 * Keeps the exact classes the Sidebar always used — only adds the dot.
 */
export function NavLink({ href, active, onClick, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        /* 44px min touch target via min-h-11 + py-2.5 */
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {children}
      <PendingDot />
    </Link>
  );
}
