"use client";

/**
 * Workspace Switcher — Sidebar header component for switching between workspaces.
 *
 * Features:
 * - Shows current workspace name + plan badge
 * - Dropdown to switch between user's workspaces
 * - Keyboard accessible (Escape to close, Enter/Space to select)
 * - 44px touch targets, focus-visible rings
 * - Smooth 200ms transitions
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@cendaro/ui";

import { useWorkspace } from "~/hooks/use-workspace";
import { useTRPC } from "~/trpc/client";

// ── Plan badge config ──────────────────────────
const PLAN_CONFIG = {
  starter: {
    label: "Starter",
    classes: "bg-muted text-muted-foreground",
  },
  pro: {
    label: "Pro",
    classes: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  enterprise: {
    label: "Enterprise",
    classes: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  },
} as const;

// ── Component ──────────────────────────────────
export function WorkspaceSwitcher() {
  const { workspaceId, switchWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Fetch workspaces
  const trpc = useTRPC();
  const { data: workspaces, isLoading } = useQuery(
    trpc.workspace.list.queryOptions(),
  );

  // Current workspace
  const current = workspaces?.find((ws) => ws.id === workspaceId);

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0 && workspaces[0]) {
      switchWorkspace(workspaces[0].id);
    }
  }, [workspaceId, workspaces, switchWorkspace]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleSelect = useCallback(
    (id: string) => {
      switchWorkspace(id);
      setIsOpen(false);
      // Force full page reload to clear stale data
      window.location.reload();
    },
    [switchWorkspace],
  );

  const planConfig = current?.plan
    ? PLAN_CONFIG[current.plan]
    : PLAN_CONFIG.starter;

  // Generate initials from workspace name
  const initials = current?.name
    ? current.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2",
          "cursor-pointer transition-colors duration-150",
          "hover:bg-sidebar-accent/50",
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Cambiar workspace"
      >
        {/* Workspace avatar */}
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
          {isLoading ? (
            <span className="material-symbols-outlined animate-spin text-sm">
              progress_activity
            </span>
          ) : (
            initials
          )}
        </div>

        {/* Name + plan */}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sidebar-foreground truncate text-sm leading-tight font-semibold">
            {isLoading ? "Cargando…" : (current?.name ?? "Seleccionar")}
          </p>
          {current && (
            <span
              className={cn(
                "mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wider uppercase",
                planConfig.classes,
              )}
            >
              {planConfig.label}
            </span>
          )}
        </div>

        {/* Chevron */}
        <span
          className={cn(
            "material-symbols-outlined text-muted-foreground text-lg transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Lista de workspaces"
          className={cn(
            "border-sidebar-border bg-sidebar absolute top-full right-0 left-0 z-50 mt-1 rounded-lg border shadow-lg",
            "animate-in fade-in slide-in-from-top-1 duration-200",
          )}
        >
          <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {workspaces?.map((ws) => {
              const isActive = ws.id === workspaceId;
              const wsInitials = ws.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const wsPlan = PLAN_CONFIG[ws.plan];

              return (
                <button
                  key={ws.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    "flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 py-2",
                    "cursor-pointer transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none",
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {wsInitials}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{ws.name}</p>
                    <span
                      className={cn(
                        "inline-block rounded-full px-1.5 py-px text-[9px] font-semibold tracking-wider uppercase",
                        wsPlan.classes,
                      )}
                    >
                      {wsPlan.label}
                    </span>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <span className="material-symbols-outlined text-primary text-lg">
                      check
                    </span>
                  )}
                </button>
              );
            })}

            {workspaces?.length === 0 && (
              <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                No tienes workspaces disponibles
              </p>
            )}
          </div>

          {/* Create workspace */}
          <div className="border-sidebar-border border-t p-1">
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Navigate to workspace creation flow
              }}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 py-2",
                "text-muted-foreground cursor-pointer transition-colors duration-150",
                "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <span className="material-symbols-outlined text-lg">
                add_circle
              </span>
              <span className="text-sm font-medium">Crear workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
