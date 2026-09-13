"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@cendaro/ui";

import { useCurrentUser } from "~/hooks/use-current-user";
import { MainMenu } from "./main-menu";
import { WorkspaceStack } from "./workspace-stack";

const RAIL_TRANSITION =
  "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]";

/**
 * Desktop rail — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1, M-01/M-02 (T2.2).
 * Hidden below `md`; the mobile drawer (T2.5) covers small screens.
 *
 * Expands 70→240px (M-01) on hover OR keyboard focus (DEV-4: Midday only
 * expands on hover, but this ERP keeps focus-visible parity for keyboard
 * users). The header (M-02) is absolutely positioned over the top so the
 * nav below can use `pt-17.5` to clear it, exactly as spec'd in §5.8.1.
 *
 * The workspace stack (M-08, `workspace-stack.tsx`) renders `fixed` to the
 * viewport rather than participating in this flex flow — the trailing empty
 * div below only reserves the bottom `justify-between` slot's height so the
 * nav column above doesn't stretch to fill it.
 */
export function Rail() {
  const { profile } = useCurrentUser();
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovering || focused;

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setFocused(false);
        }
      }}
      className={cn(
        "border-border bg-background fixed top-0 z-50 hidden h-screen flex-col items-center justify-between border-r pb-4 md:flex",
        RAIL_TRANSITION,
        expanded ? "w-60" : "w-17.5",
      )}
    >
      {/* M-02 — rail header, logo fixed at left-5.5, no transition on the mark itself */}
      <div
        className={cn(
          "border-border absolute top-0 left-0 h-17.5 border-b",
          RAIL_TRANSITION,
          expanded ? "w-full" : "w-17.25",
        )}
      >
        <Link
          href="/dashboard"
          className="absolute top-1/2 left-5.5 -translate-y-1/2"
          aria-label="Ir al panel"
        >
          <Image
            src="/cendaro-logo.png"
            alt="Cendaro"
            width={24}
            height={24}
            // The mark is painted pure white on a transparent PNG (no dark
            // ink at all — confirmed pixel-by-pixel) and disappears against
            // a light-theme header; invert it back to visible in light mode.
            className="size-6 invert dark:invert-0"
            priority
          />
        </Link>
      </div>

      <nav
        aria-label="Navegación principal"
        className="border-border mb-3 w-full flex-1 border-b pt-17.5"
      >
        <MainMenu role={profile?.role ?? null} expanded={expanded} />
      </nav>

      <WorkspaceStack expanded={expanded} />
      <div aria-hidden className="h-8 w-full" />
    </aside>
  );
}
