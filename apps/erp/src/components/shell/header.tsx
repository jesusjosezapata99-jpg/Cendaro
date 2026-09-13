"use client";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { CommandSearch } from "~/components/command-search";
import { NotificationCenter } from "./notification-center";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  /** Opens the mobile drawer (T2.5). Hamburger only renders when provided. */
  onToggleMobileMenu?: () => void;
}

/**
 * Content-column header — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1 (T2.4).
 * `h-17.5 px-6 md:border-b`, search on the left, notifications + user avatar
 * grouped on the right via `ml-auto`. Mobile gets a translucent blur bar
 * instead of the border (`backdrop-blur-xl bg-background/70`).
 */
export function Header({ onToggleMobileMenu }: HeaderProps) {
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
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
