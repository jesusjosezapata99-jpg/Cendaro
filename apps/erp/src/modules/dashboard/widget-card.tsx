import Link from "next/link";

import type { IconName } from "@cendaro/ui/icons";
import { cn, Skeleton } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

interface WidgetCardProps {
  icon: IconName;
  title: string;
  href?: string;
  footerLabel?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Dashboard widget card (PLAN-2026-09-DESIGN-SYSTEM §5.8.2, M-11) — the
 * shared shell every one of the 8 widgets in `./widgets/*.tsx` renders
 * inside. Fixed `min-h-47.5` so the grid never reflows as data streams
 * in; `WidgetCardSkeleton` below mirrors the exact same dimensions so the
 * loading → loaded swap is CLS 0.
 */
export function WidgetCard({
  icon,
  title,
  href,
  footerLabel = "Ver más",
  children,
  className,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        "border-line bg-surface hover:bg-surface-hover hover:border-line-hover flex min-h-47.5 flex-col justify-between border p-4 transition-all duration-300",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon name={icon} className="size-4" />
        {title}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1 py-2">
        {children}
      </div>

      {href ? (
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          {footerLabel}
          <Icons.ArrowOutward className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

/** Same footprint as `WidgetCard` — used while `dashboard.overview` loads. */
export function WidgetCardSkeleton() {
  return (
    <div className="border-line bg-surface flex min-h-47.5 flex-col justify-between border p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex flex-col gap-2 py-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
