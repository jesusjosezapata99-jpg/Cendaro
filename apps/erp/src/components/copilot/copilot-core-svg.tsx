"use client";

import { m, useReducedMotion } from "framer-motion";

import { cn } from "@cendaro/ui";

export type CopilotVisualState = "idle" | "hovered" | "thinking" | "open";

export interface CopilotCoreSvgProps {
  state?: CopilotVisualState;
  size?: number;
  innerCutoutColor?: string;
  className?: string;
}

const CENTER_ORIGIN: React.CSSProperties = {
  transformOrigin: "32px 32px",
  transformBox: "view-box",
};

/**
 * Bespoke architectural kinetic emblem for Cendaro's conversational AI Copilot.
 *
 * Built for the 0-radius monochrome design system:
 *   • Layer 1: Architectural corner calibration brackets
 *   • Layer 2: Clockwise precision astrolabe reticle ring (r=25)
 *   • Layer 3: Counter-rotating orbital telemetry arc + dual cardinal nodes (r=18.5)
 *   • Layer 4: Harmonic pulse wave on active reasoning (`thinking`) / hover
 *   • Layer 5: Morphing faceted 4-point prism & inner precision diamond core
 *
 * Uses strictly `currentColor` and semantic CSS variables (`var(--status-info-fg)`),
 * with zero hex/rgb literals and full `prefers-reduced-motion` support.
 */
export function CopilotCoreSvg({
  state = "idle",
  size = 28,
  innerCutoutColor = "var(--primary)",
  className,
}: CopilotCoreSvgProps) {
  const prefersReducedMotion = useReducedMotion();
  const isThinking = state === "thinking";
  const isHovered = state === "hovered";
  const isOpen = state === "open";

  const outerDuration = isThinking ? 2.8 : isHovered ? 9 : 26;
  const innerDuration = isThinking ? 1.9 : isHovered ? 6 : 18;

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
      {/* Layer 1: Architectural corner calibration hairlines */}
      <m.g
        style={CENTER_ORIGIN}
        animate={
          prefersReducedMotion
            ? { scale: 1, opacity: isHovered || isOpen ? 0.85 : 0.45 }
            : {
                scale: isHovered || isThinking ? 1.04 : 1,
                opacity: isThinking ? 0.9 : isHovered || isOpen ? 0.75 : 0.4,
              }
        }
        transition={{ duration: 0.28, ease: "easeOut" }}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      >
        <path d="M7 15V7H15" />
        <path d="M49 7H57V15" />
        <path d="M57 49V57H49" />
        <path d="M15 57H7V49" />
      </m.g>

      {/* Layer 2: Clockwise astrolabe dashed reticle ring */}
      <m.g
        style={CENTER_ORIGIN}
        animate={
          prefersReducedMotion || isOpen
            ? { rotate: isOpen ? 45 : 0 }
            : { rotate: 360 }
        }
        transition={
          prefersReducedMotion || isOpen
            ? { duration: 0.35, ease: "easeOut" }
            : {
                duration: outerDuration,
                repeat: Infinity,
                ease: "linear",
              }
        }
      >
        <circle
          cx="32"
          cy="32"
          r="24.5"
          stroke="currentColor"
          strokeOpacity={isThinking ? 0.75 : 0.38}
          strokeWidth="1.25"
          strokeDasharray="5 5"
        />
        <line
          x1="32"
          y1="4.5"
          x2="32"
          y2="9"
          stroke="currentColor"
          strokeOpacity="0.8"
          strokeWidth="1.5"
        />
        <line
          x1="32"
          y1="55"
          x2="32"
          y2="59.5"
          stroke="currentColor"
          strokeOpacity="0.8"
          strokeWidth="1.5"
        />
        <line
          x1="4.5"
          y1="32"
          x2="9"
          y2="32"
          stroke="currentColor"
          strokeOpacity="0.8"
          strokeWidth="1.5"
        />
        <line
          x1="55"
          y1="32"
          x2="59.5"
          y2="32"
          stroke="currentColor"
          strokeOpacity="0.8"
          strokeWidth="1.5"
        />
      </m.g>

      {/* Layer 3: Counter-rotating orbital telemetry arc + dual satellite nodes */}
      <m.g
        style={CENTER_ORIGIN}
        animate={
          prefersReducedMotion || isOpen
            ? { rotate: isOpen ? -45 : 0 }
            : { rotate: -360 }
        }
        transition={
          prefersReducedMotion || isOpen
            ? { duration: 0.35, ease: "easeOut" }
            : {
                duration: innerDuration,
                repeat: Infinity,
                ease: "linear",
              }
        }
      >
        <circle
          cx="32"
          cy="32"
          r="18"
          stroke={isThinking ? "var(--status-info-fg)" : "currentColor"}
          strokeOpacity={isThinking ? 0.95 : 0.62}
          strokeWidth="1.5"
          strokeDasharray="24 14 16 14"
        />
        <rect
          x="30.4"
          y="12.4"
          width="3.2"
          height="3.2"
          fill={isThinking ? "var(--status-info-fg)" : "currentColor"}
        />
        <rect
          x="30.4"
          y="48.4"
          width="3.2"
          height="3.2"
          fill="currentColor"
          fillOpacity="0.8"
        />
      </m.g>

      {/* Layer 4: Active reasoning harmonic wave */}
      {isThinking && !prefersReducedMotion ? (
        <m.circle
          cx="32"
          cy="32"
          r="13"
          stroke="var(--status-info-fg)"
          strokeWidth="1.6"
          style={CENTER_ORIGIN}
          initial={{ scale: 0.85, opacity: 0.85 }}
          animate={{ scale: 1.75, opacity: 0 }}
          transition={{
            duration: 1.25,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ) : null}

      {/* Layer 5: Central faceted 4-point prism + inner precision core */}
      <m.g
        style={CENTER_ORIGIN}
        animate={
          prefersReducedMotion
            ? {
                scale: isHovered ? 1.08 : 1,
                rotate: isOpen ? 45 : 0,
              }
            : isThinking
              ? {
                  scale: [0.92, 1.14, 0.92],
                  rotate: [0, 90, 180],
                }
              : isHovered
                ? {
                    scale: 1.12,
                    rotate: 45,
                  }
                : isOpen
                  ? {
                      scale: 1,
                      rotate: 45,
                    }
                  : {
                      scale: [1, 1.06, 1],
                      rotate: 0,
                    }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : isThinking
              ? {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : isHovered || isOpen
                ? {
                    duration: 0.3,
                    ease: "easeOut",
                  }
                : {
                    duration: 3.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
        }
      >
        <path
          d="M32 17L36.2 27.8L47 32L36.2 36.2L32 47L27.8 36.2L17 32L27.8 27.8L32 17Z"
          fill="currentColor"
        />
        <path
          d="M32 26.5L37.5 32L32 37.5L26.5 32L32 26.5Z"
          fill={isThinking ? "var(--status-info-fg)" : innerCutoutColor}
          fillOpacity={isThinking ? 1 : 0.92}
        />
      </m.g>
    </svg>
  );
}
