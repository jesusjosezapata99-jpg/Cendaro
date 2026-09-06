import Link from "next/link";

import { cn } from "@cendaro/ui";

export type StatTone =
  "default" | "primary" | "success" | "warning" | "destructive";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line — e.g. the Bs. amount under the USD total. */
  sub?: React.ReactNode;
  /** Material Symbols ligature (e.g. "receipt_long"). */
  icon?: string;
  tone?: StatTone;
  /** Makes the card a navigable link with hover affordance. */
  href?: string;
  className?: string;
}

const toneIconStyles: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success-soft",
  warning: "bg-warning/15 text-warning-soft",
  destructive: "bg-destructive/10 text-destructive-soft",
};

/**
 * KPI card for dashboard/stat rows — neutral card (Apple-clean), icon in a
 * soft token chip, value in semibold tabular numerals. Optional link affordance.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs font-medium tracking-widest uppercase">
          {label}
        </span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              "material-symbols-outlined flex size-7 shrink-0 items-center justify-center rounded-lg text-lg",
              toneIconStyles[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {sub ? (
        <div className="text-muted-foreground text-xs font-medium">{sub}</div>
      ) : null}
    </>
  );

  const classes = cn(
    "bg-card text-card-foreground flex flex-col gap-1.5 rounded-xl border p-4 shadow-xs transition-[border-color,box-shadow] duration-200 outline-none",
    href &&
      "hover:border-primary/30 focus-visible:border-ring focus-visible:ring-ring/50 hover:shadow-sm focus-visible:ring-[3px]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}
