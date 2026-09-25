import type { ReactNode } from "react";

import type { IconName } from "@cendaro/ui/icons";
import { cn } from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

/** Rail entries of the real app shell, in order (components/shell/rail.tsx). */
const RAIL: readonly IconName[] = [
  "Dashboard",
  "Category",
  "Inventory2",
  "DirectionsBoat",
  "PointOfSale",
  "ShoppingCart",
  "RequestQuote",
  "CurrencyExchange",
];

interface MiniAppShellProps {
  /** Which rail entry is active. */
  active: IconName;
  title: string;
  /** Right side of the top bar (e.g. the BCV rate chip). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Coded replica of the Cendaro app chrome for public-page product views
 * (DESIGN.md §8): rail, top bar, content. Static, decorative, token-only —
 * it renders crisp in both themes at any size and costs no media bytes.
 */
export function MiniAppShell({
  active,
  title,
  meta,
  children,
  className,
}: MiniAppShellProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-background text-foreground grid grid-cols-[2.75rem_minmax(0,1fr)] text-left select-none",
        className,
      )}
    >
      <div className="border-border flex flex-col items-center gap-1 border-r py-3">
        <span className="bg-foreground mb-2 size-4" />
        {RAIL.map((name) => (
          <span
            key={name}
            className={cn(
              "flex size-8 items-center justify-center",
              name === active
                ? "bg-muted text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon name={name} className="size-4" />
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="border-border flex h-11 items-center justify-between gap-3 border-b px-4">
          <span className="truncate text-sm font-medium">{title}</span>
          <div className="flex shrink-0 items-center gap-3">
            {meta}
            <span className="border-border text-muted-foreground hidden h-7 w-36 items-center gap-2 border px-2 text-xs sm:flex">
              <Icon name="Search" className="size-3.5" />
              Buscar
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

/** Small label + value cell used by the mini views. */
export function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-border border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums">{value}</p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/** "Datos de ejemplo" caption: the views show fictitious data (PRODUCT.md). */
export function SampleDataNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground font-mono text-xs tracking-wide",
        className,
      )}
    >
      Vista del producto con datos de ejemplo
    </p>
  );
}
