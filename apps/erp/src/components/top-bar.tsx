"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "@cendaro/ui/icons";

import { useCurrentUser } from "~/hooks/use-current-user";
import { CommandSearch } from "./command-search";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ThemeToggle } from "./theme-toggle";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { profile, loading, initials, roleLabel } = useCurrentUser();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="bg-background border-border-subtle safe-pt flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      {/* Left: hamburger */}
      <button
        onClick={onToggleSidebar}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-11 items-center justify-center rounded-lg transition-colors lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Icons.Menu className="size-5" />
      </button>

      {/* Center: command palette search */}
      <div className="flex flex-1 items-center justify-center">
        <CommandSearch />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notifications dropdown */}
        <NotificationsDropdown />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div className="bg-border mx-1 hidden h-6 w-px sm:block" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((o) => !o)}
            className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-medium">
              {loading ? "…" : initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-foreground text-xs font-medium">
                {loading ? "Cargando…" : (profile?.fullName ?? "Usuario")}
              </p>
              <p className="text-muted-foreground text-[10px]">{roleLabel}</p>
            </div>
            <Icons.ExpandMore className="text-muted-foreground hidden size-4 sm:block" />
          </button>

          {showUserMenu && (
            <div className="bg-popover border-border-subtle absolute top-full right-0 z-50 mt-1 w-48 overflow-hidden border shadow-md">
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
                    // fallback: redirect even if server call fails
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
