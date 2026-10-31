"use client";

import type { HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";

import { cn } from "@cendaro/ui";

interface AnimatedSizeContainerProps extends Omit<
  HTMLMotionProps<"div">,
  "animate" | "style" | "children"
> {
  width?: boolean;
  height?: boolean;
  children?: React.ReactNode;
}

/** Animates its own width/height to match children via ResizeObserver — used
 * for collapsible panels, dropdown height changes, etc. (§5.9). */
function AnimatedSizeContainer({
  width = false,
  height = true,
  className,
  children,
  ...props
}: AnimatedSizeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isLowSpecCpu =
      typeof navigator !== "undefined" &&
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 4;
    return prefersReduced || isLowSpecCpu;
  });

  useEffect(() => {
    if (reducedMotion) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: width ? entry.contentRect.width : undefined,
        height: height ? entry.contentRect.height : undefined,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height, reducedMotion]);

  if (reducedMotion) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <div ref={containerRef}>{children}</div>
      </div>
    );
  }

  return (
    <m.div
      className={cn("overflow-hidden", className)}
      animate={{
        width: size.width,
        height: size.height,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25, mass: 1.2 }}
      {...props}
    >
      <div ref={containerRef}>{children}</div>
    </m.div>
  );
}

export { AnimatedSizeContainer };
