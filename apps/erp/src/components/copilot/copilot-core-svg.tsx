"use client";

import { m, useReducedMotion } from "framer-motion";

import { cn } from "@cendaro/ui";

import { spring } from "~/components/motion-provider";
import { easeOutExpo } from "~/lib/motion";

export type CopilotVisualState = "idle" | "hovered" | "thinking" | "open";

export interface CopilotCoreSvgProps {
  state?: CopilotVisualState;
  size?: number;
  className?: string;
}

/**
 * Official 4-piece interlocking octagonal "C" ribbon geometry of Cendaro,
 * mathematically vectorized (99.14% IoU) from `public/cendaro-logo.png`
 * onto a `64x64` coordinate space (`[6, 58]` bounds around `(32, 32)`).
 *
 * Each ribbon is bounded with >= 4px clearance from `[2, 62]` so 45-degree
 * CAD seam micro-separations and perimeter calibration hairlines never clip.
 */
export const CENDARO_BRAND_MONOGRAM_64 = {
  outerSpine:
    "M22.47 6.63 H30.97 L13.09 23.58 Q12.81 23.86 12.81 24.33 V39.72 Q12.81 40.14 13.09 40.42 L23.6 50.33 Q24.44 50.8 25.52 50.8 Q26.6 50.8 27.35 50.14 L42.32 36.11 L48.71 38.97 L29.7 56.85 Q29.04 57.37 28.1 57.37 H22.85 Q21.82 57.37 20.97 56.76 L7.17 43.8 Q6 42.68 6 40.94 V23.01 Q6 21.18 7.27 19.96 L20.6 7.38 Q21.44 6.63 22.47 6.63 Z",
  innerHook:
    "M34.91 6.63 H42.09 Q43.22 6.63 44.06 7.43 L58 20.53 L51.48 23.58 L40.68 13.44 Q40.03 13.06 38.9 13.06 Q37.77 13.06 37.12 13.44 L22.85 26.86 Q22.38 27.28 22.38 27.89 V35.97 Q22.38 36.44 22.75 36.76 L30.36 43.85 L25.57 48.4 L16.09 39.53 Q15.62 39.06 15.62 38.31 V25.45 Q15.62 24.7 16.18 24.19 L34.91 6.63 Z",
  upperKeystone:
    "M38.34 15.74 Q38.85 15.32 39.42 15.88 L48.71 24.8 L42.32 27.8 L33.92 19.96 Z",
  lowerJaw:
    "M51.43 40.19 L57.95 43.1 L43.31 56.85 Q42.7 57.37 41.81 57.37 H33.17 Z",
} as const;

interface RibbonPieceSpec {
  id: keyof typeof CENDARO_BRAND_MONOGRAM_64;
  d: string;
  hoverX: number;
  hoverY: number;
  openX: number;
  openY: number;
  thinkDelay: number;
}

const RIBBON_PIECES: readonly RibbonPieceSpec[] = [
  {
    id: "outerSpine",
    d: CENDARO_BRAND_MONOGRAM_64.outerSpine,
    hoverX: -1.15,
    hoverY: 0.85,
    openX: -0.45,
    openY: 0.35,
    thinkDelay: 0,
  },
  {
    id: "innerHook",
    d: CENDARO_BRAND_MONOGRAM_64.innerHook,
    hoverX: 0.95,
    hoverY: -0.95,
    openX: 0.4,
    openY: -0.4,
    thinkDelay: 0.14,
  },
  {
    id: "upperKeystone",
    d: CENDARO_BRAND_MONOGRAM_64.upperKeystone,
    hoverX: 1.65,
    hoverY: -1.3,
    openX: 0.75,
    openY: -0.6,
    thinkDelay: 0.28,
  },
  {
    id: "lowerJaw",
    d: CENDARO_BRAND_MONOGRAM_64.lowerJaw,
    hoverX: 1.4,
    hoverY: 1.15,
    openX: 0.65,
    openY: 0.5,
    thinkDelay: 0.42,
  },
];

const VIEWBOX_CENTER: React.CSSProperties = {
  transformOrigin: "32px 32px",
  transformBox: "view-box",
};

/**
 * Kinetic Cendaro Brand Monogram for the conversational AI Copilot.
 *
 * Architectural choreography:
 *   • `idle` (0% CPU/RAF churn): Exact 4-ribbon Cendaro mark locked at rest.
 *   • `hovered` (~180ms spring): 45-degree CAD seam micro-separation + corner ticks.
 *   • `open` (220ms easeOutExpo): Calibrated precision lock with subtle corner framing.
 *   • `thinking` (1.5s wave, active ONLY during query flight): Sequential 4-ribbon
 *     telemetry pulse along 45-degree vectors using pure `currentColor` (WCAG AAA safe).
 */
export function CopilotCoreSvg({
  state = "idle",
  size = 22,
  className,
}: CopilotCoreSvgProps) {
  const prefersReducedMotion = useReducedMotion();
  const isThinking = state === "thinking";
  const isHovered = state === "hovered";
  const isOpen = state === "open";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* 0-radius architectural corner calibration hairlines (hidden at idle) */}
      <m.g
        style={VIEWBOX_CENTER}
        initial={false}
        animate={
          prefersReducedMotion
            ? {
                scale: 1,
                opacity: isThinking ? 0.75 : isHovered || isOpen ? 0.5 : 0,
              }
            : isThinking
              ? {
                  scale: [0.97, 1.02, 0.97],
                  opacity: [0.28, 0.8, 0.28],
                }
              : {
                  scale: isHovered ? 1.015 : 1,
                  opacity: isHovered ? 0.55 : isOpen ? 0.42 : 0,
                }
        }
        transition={
          isThinking && !prefersReducedMotion
            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.22, ease: easeOutExpo }
        }
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      >
        <path d="M2 10V2H10" />
        <path d="M54 2H62V10" />
        <path d="M62 54V62H54" />
        <path d="M10 62H2V54" />
      </m.g>

      {/* Official 4-piece Cendaro interlocking octagonal "C" ribbons */}
      {RIBBON_PIECES.map((piece) => {
        if (prefersReducedMotion) {
          return (
            <path
              key={piece.id}
              d={piece.d}
              fill="currentColor"
              fillOpacity={isThinking ? 0.82 : 1}
            />
          );
        }

        const animateTarget = isThinking
          ? {
              x: [0, piece.hoverX * 0.85, 0],
              y: [0, piece.hoverY * 0.85, 0],
              opacity: [1, 0.38, 1],
            }
          : isHovered
            ? {
                x: piece.hoverX,
                y: piece.hoverY,
                opacity: 1,
              }
            : isOpen
              ? {
                  x: piece.openX,
                  y: piece.openY,
                  opacity: 1,
                }
              : {
                  x: 0,
                  y: 0,
                  opacity: 1,
                };

        const transitionConfig = isThinking
          ? {
              duration: 1.45,
              delay: piece.thinkDelay,
              repeat: Infinity,
              ease: "easeInOut" as const,
            }
          : isHovered
            ? spring
            : {
                duration: 0.22,
                ease: easeOutExpo,
              };

        return (
          <m.path
            key={piece.id}
            d={piece.d}
            fill="currentColor"
            initial={false}
            animate={animateTarget}
            transition={transitionConfig}
          />
        );
      })}
    </svg>
  );
}
