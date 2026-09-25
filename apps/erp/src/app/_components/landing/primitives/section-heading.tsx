import type { ReactNode } from "react";

import { cn } from "@cendaro/ui";

import { Reveal } from "./reveal";

interface SectionHeadingProps {
  /** Mono index + label above the title, e.g. index "02" label "Cómo funciona". */
  eyebrow?: { index?: string; label: string };
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "start";
  /** Heading level: h1 on feature-page heroes, h2 everywhere else. */
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}

/**
 * Section title in the public-site type scale (DESIGN.md §6): mono eyebrow,
 * Hedvig Serif display heading, muted lead paragraph.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  as: Heading = "h2",
  id,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        centered ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
          {eyebrow.index ? (
            <span className="text-foreground">{eyebrow.index} — </span>
          ) : null}
          {eyebrow.label}
        </p>
      ) : null}
      <Heading
        id={id}
        className={cn(
          "text-foreground font-serif leading-[1.08] tracking-[-0.02em] text-balance",
          Heading === "h1"
            ? "text-[clamp(2.5rem,6vw,5rem)]"
            : "text-[clamp(2rem,3.5vw,3rem)]",
          centered ? "max-w-3xl" : "max-w-2xl",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground text-lg leading-relaxed text-pretty",
            centered ? "max-w-2xl" : "max-w-xl",
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
