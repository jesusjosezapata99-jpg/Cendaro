"use client";

import { useId } from "react";

/**
 * SVG grain/noise texture overlay — adds organic depth to dark sections.
 * Inspired by midday.ai's premium enterprise aesthetic.
 * Usage: Place as a child of a `relative` container.
 */
export function NoiseOverlay({ opacity = 0.035 }: { opacity?: number }) {
  const filterId = useId();

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
      style={{ opacity }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}

/**
 * Thin horizontal divider line between sections.
 */
export function SectionDivider() {
  return (
    <div className="pointer-events-none relative h-24" aria-hidden="true">
      <div className="from-background absolute inset-x-0 top-0 h-12 bg-linear-to-b to-transparent" />
      <div className="to-background absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-transparent" />
    </div>
  );
}
