"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

interface ScrollEntranceProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Direction the element enters from */
  direction?: "up" | "down" | "left" | "right";
}

export function ScrollEntrance({
  children,
  className,
  delay = 0,
  direction = "up",
}: ScrollEntranceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const prefersReducedMotion = useReducedMotion();

  const directionOffset = {
    up: { y: 24 },
    down: { y: -24 },
    left: { x: 24 },
    right: { x: -24 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              filter: "blur(10px)",
              ...directionOffset[direction],
            }
      }
      animate={
        isInView
          ? prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 1, filter: "blur(0px)", x: 0, y: 0 }
          : undefined
      }
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.6,
        ease: [0.16, 1, 0.3, 1],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger wrapper — wraps children and staggers their entrance */
export function StaggerGroup({
  children,
  className,
  staggerDelay = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Child item for StaggerGroup */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 24, filter: "blur(10px)" },
        visible: prefersReducedMotion
          ? {
              opacity: 1,
              transition: { duration: 0.2 },
            }
          : {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            },
      }}
    >
      {children}
    </motion.div>
  );
}
