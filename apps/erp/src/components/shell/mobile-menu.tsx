"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import type { UserRole } from "@cendaro/validators";
import { Sheet, SheetContent, SheetTitle } from "@cendaro/ui/sheet";

import { MainMenu } from "./main-menu";
import { WorkspaceStack } from "./workspace-stack";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  role: UserRole | null;
}

/**
 * Mobile navigation — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1 (T2.5): a left
 * Sheet (M-14) reusing `MainMenu` in its permanently-expanded state (there's
 * no hover on touch, so labels are always shown) plus the same
 * `WorkspaceStack` from T2.3 — omitting it here would make workspace
 * switching unreachable on mobile, since the desktop rail (and its stack)
 * is `hidden` below `md`.
 */
export function MobileMenu({ open, onClose, role }: MobileMenuProps) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // "se cierra al navegar" — close only on an actual route change, not on mount.
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="left" className="w-3/4 max-w-70 p-0 sm:max-w-70">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <nav
          aria-label="Navegación principal"
          className="flex-1 overflow-y-auto overscroll-contain pt-6"
        >
          <MainMenu role={role} expanded onNavigate={onClose} />
        </nav>
        <WorkspaceStack expanded />
      </SheetContent>
    </Sheet>
  );
}
