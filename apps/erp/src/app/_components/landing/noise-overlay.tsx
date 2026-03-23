"use client";

/**
 * SVG grain/noise texture overlay — adds organic depth to dark sections.
 * Inspired by midday.ai's premium enterprise aesthetic.
 * Usage: Place as a child of a `relative` container.
 */
export function NoiseOverlay({ opacity = 0.035 }: { opacity?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
      style={{ opacity }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}

/**
 * Thin horizontal divider line between sections.
 */
export function SectionDivider() {
  return (
    <div className="mx-auto max-w-7xl px-6" aria-hidden="true">
      <div className="h-px w-full bg-[rgba(255,255,255,0.06)]" />
    </div>
  );
}
