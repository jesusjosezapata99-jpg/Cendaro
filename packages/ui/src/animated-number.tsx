"use client";

import type { NumberFlowProps } from "@number-flow/react";
import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

import { cn } from "@cendaro/ui";

interface AnimatedNumberProps extends Omit<NumberFlowProps, "animated"> {
  className?: string;
}

/**
 * Animated numeric readout (§5.9, M-17) — a thin wrapper over `NumberFlow`
 * that skips the flip animation on the very first paint (nothing real to
 * animate *from* yet, so the initial render just shows the number) and only
 * turns animation on once a non-zero value has actually been displayed —
 * otherwise a placeholder `0` rolling into the real figure on first load
 * would misrepresent a change that never happened.
 */
export function AnimatedNumber({
  value,
  locales = "es-VE",
  className,
  ...props
}: AnimatedNumberProps) {
  const [hasPaintedNonZero, setHasPaintedNonZero] = useState(false);

  useEffect(() => {
    if (typeof value === "number" && value !== 0) setHasPaintedNonZero(true);
  }, [value]);

  return (
    <NumberFlow
      value={value}
      locales={locales}
      animated={hasPaintedNonZero}
      willChange
      className={cn(className)}
      {...props}
    />
  );
}
