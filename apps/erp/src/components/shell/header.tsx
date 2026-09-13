"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { CommandSearch } from "~/components/command-search";
import { NotificationsDropdown } from "~/components/notifications-dropdown";
import { useCurrentUser } from "~/hooks/use-current-user";

interface HeaderProps {
  /** Opens the mobile drawer (T2.5). Hamburger only renders when provided. */
  onToggleMobileMenu?: () => void;
}

/**
 * Content-column header — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1 (T2.4).
 * `h-17.5 px-6 md:border-b`, search on the left, notifications + user avatar
 * grouped on the right via `ml-auto`. Mobile gets a translucent blur bar
 * instead of the border (`backdrop-blur-xl bg-background/70`).
 *
 * The user menu here is a minimal inline dropdown (Configuración, Auditoría,
 * Cerrar sesión) ported from `top-bar.tsx` so this header is fully
 * functional on its own — T2.7 replaces it with the dedicated
 * `user-menu.tsx` (adds the "Tema" row once T2.8's ThemeSwitch exists).
 */
export function Header({ onToggleMobileMenu }: HeaderProps) {
  const router = useRouter();
  const { loading, initials } = useCurrentUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className={cn(
        "flex h-17.5 items-center justify-between px-6",
        "border-border md:border-b",
        "bg-background/70 md:bg-background backdrop-blur-xl md:backdrop-blur-none",
      )}
    >
      <div className="flex items-center gap-2">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-11 items-center justify-center md:hidden"
            aria-label="Abrir menú"
          >
            <Icons.Menu className="size-5" />
          </button>
        )}
        <CommandSearch />
      </div>

      <div className="ml-auto flex items-center space-x-2">
        <NotificationsDropdown />

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((o) => !o)}
            className="bg-accent flex size-8 items-center justify-center rounded-full text-sm font-medium"
            aria-label="Menú de usuario"
            aria-expanded={showUserMenu}
          >
            {loading ? "…" : initials}
          </button>

          {showUserMenu && (
            <div className="bg-popover border-border absolute top-full right-0 z-50 mt-1 w-48 overflow-hidden border shadow-md">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/settings");
                }}
                className="text-foreground hover:bg-accent/50 flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              >
                <Icons.Settings className="text-muted-foreground size-4" />
                Configuración
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/audit");
                }}
                className="text-foreground hover:bg-accent/50 flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              >
                <Icons.History className="text-muted-foreground size-4" />
                Log de Auditoría
              </button>
              <div className="bg-border my-1 h-px" />
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } catch {
                    // fallback: redirect even if the server call fails
                  }
                  window.location.href = "/login";
                }}
                className="hover:bg-accent/50 text-destructive flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              >
                <Icons.Logout className="size-4" />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
