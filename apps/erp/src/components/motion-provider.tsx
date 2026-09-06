"use client";

import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";

/**
 * Shared spring vocabulary — ~180ms settle, no overshoot (Apple-like).
 */
export const spring = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.9,
} as const;

export const springSoft = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 1,
} as const;

/**
 * Global motion runtime.
 *
 * - `LazyMotion` + `m.` components keep the framer-motion runtime at ~5 kB
 *   (vs ~34 kB for the full `motion.` import) — the only physics cost we ship.
 * - `strict` forbids the heavy `motion.` component in app code.
 * - `MotionConfig reducedMotion="user"` disables transforms globally when the
 *   OS requests reduced motion (a11y).
 * - The default `transition` makes every `m.` component spring by default —
 *   callers override per-animation when needed.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.9 }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
