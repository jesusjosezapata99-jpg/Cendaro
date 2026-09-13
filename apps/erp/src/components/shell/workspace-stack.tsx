"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";

import { Avatar, AvatarFallback } from "@cendaro/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cendaro/ui/tooltip";

import { useWorkspace } from "~/hooks/use-workspace";
import { useTRPC } from "~/trpc/client";

const STACK_SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 1.2,
} as const;

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface WorkspaceStackProps {
  /** Whether the rail is hover/focus-expanded — shows the current workspace's name label. */
  expanded: boolean;
}

/**
 * Workspace stack — PLAN-2026-09-MIDDAY-REDESIGN M-08, §5.8.1 (T2.3).
 * Fixed to the viewport (matching Midday's `team-dropdown.tsx`, independent
 * of the rail's own flex flow): a stacked deck of workspace avatars anchored
 * bottom-left, current workspace on top. Clicking it fans the deck upward
 * with a spring so every workspace becomes selectable; clicking any avatar,
 * or elsewhere, collapses it back.
 *
 * The "+" create-workspace button in M-08 is intentionally omitted here:
 * `workspace-switcher.tsx`'s own creation button is still a
 * `// TODO: Navigate to workspace creation flow` with no real destination —
 * the plan says to omit it when no such flow exists yet.
 */
export function WorkspaceStack({ expanded }: WorkspaceStackProps) {
  const { workspaceId, switchWorkspace } = useWorkspace();
  const trpc = useTRPC();
  const { data: workspaces } = useQuery(trpc.workspace.list.queryOptions());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!expanded) setOpen(false);
  }, [expanded]);

  if (!workspaces || workspaces.length === 0) return null;

  // Current workspace always renders on top of the collapsed deck (index 0).
  const ordered = [...workspaces].sort((a, b) => {
    if (a.id === workspaceId) return -1;
    if (b.id === workspaceId) return 1;
    return 0;
  });
  const current = ordered[0];

  return (
    <div ref={containerRef} className="fixed bottom-4 left-4.75 z-50">
      {ordered.map((ws, i) => {
        const isCurrent = ws.id === workspaceId;
        return (
          <Tooltip key={ws.id} delayDuration={50}>
            <TooltipTrigger asChild>
              <m.button
                type="button"
                onClick={() => {
                  if (!open) {
                    setOpen(true);
                    return;
                  }
                  if (!isCurrent) switchWorkspace(ws.id);
                  setOpen(false);
                }}
                className="absolute bottom-0 left-0"
                style={{ zIndex: -i }}
                animate={
                  open
                    ? { y: -(32 + 10) * i, scale: 1 }
                    : { y: 5 * i, scale: 1 - 0.16 * i }
                }
                transition={STACK_SPRING}
                aria-label={ws.name}
                aria-current={isCurrent ? "true" : undefined}
              >
                <Avatar variant="workspace">
                  <AvatarFallback>{initialsOf(ws.name)}</AvatarFallback>
                </Avatar>
              </m.button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {ws.name}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Current workspace name — only while the rail is expanded and the deck is collapsed */}
      {expanded && !open && current && (
        <span className="text-foreground pointer-events-none absolute bottom-0 left-15.5 flex h-8 items-center text-sm font-medium whitespace-nowrap">
          {current.name}
        </span>
      )}
    </div>
  );
}
