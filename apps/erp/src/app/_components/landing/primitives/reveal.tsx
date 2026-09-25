import type { CSSProperties, ReactNode } from "react";

import { cn } from "@cendaro/ui";

/**
 * Scroll entrance for public-site content (PLAN-2026-09-LANDING-REDESIGN
 * §4.4). A Server Component: it only renders `data-reveal`; the single
 * client `RevealObserver` in the marketing layout animates every instance,
 * and the CSS in globals.css keeps the content visible without JavaScript.
 *
 * - `up`: text and small blocks (16px rise).
 * - `fade`: opacity only (lists, rules).
 * - `rise`: product frames and media (24px rise + scale .98 → 1).
 */
type RevealVariant = "up" | "fade" | "rise";
type RevealTag = "div" | "section" | "article" | "li" | "p" | "span" | "figure";

interface RevealProps {
  children: ReactNode;
  as?: RevealTag;
  variant?: RevealVariant;
  /** Stagger offset in ms (keep ≤ 60 ms per sibling, ≤ 6 siblings). */
  delay?: number;
  className?: string;
  id?: string;
}

export function Reveal({
  children,
  as: Tag = "div",
  variant = "up",
  delay = 0,
  className,
  id,
}: RevealProps) {
  const style =
    delay > 0
      ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties)
      : undefined;

  return (
    <Tag id={id} data-reveal={variant} className={cn(className)} style={style}>
      {children}
    </Tag>
  );
}
