import type { CSSProperties, ReactNode } from "react";

import { cn } from "@cendaro/ui";

import { GRAIN_TILE, GRAIN_TILE_SIZE } from "../grain.generated";

interface GrainBackdropProps {
  children: ReactNode;
  className?: string;
}

const GRAIN_STYLE: CSSProperties = {
  backgroundImage: `url("${GRAIN_TILE}")`,
  backgroundSize: `${GRAIN_TILE_SIZE}px ${GRAIN_TILE_SIZE}px`,
};

/**
 * Monochrome "window light" backdrop behind product frames (DESIGN.md §6):
 * a diagonal gradient built from theme tokens plus a 12 KB transparent grain
 * tile (scripts/landing-media/build-grain.mjs). No runtime SVG filters.
 * `isolate` makes the -z-10 grain paint above this element's gradient but
 * below its children.
 */
export function GrainBackdrop({ children, className }: GrainBackdropProps) {
  return (
    <div
      className={cn(
        "from-muted via-card to-background relative isolate overflow-hidden bg-linear-to-br",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={GRAIN_STYLE}
      />
      {children}
    </div>
  );
}
