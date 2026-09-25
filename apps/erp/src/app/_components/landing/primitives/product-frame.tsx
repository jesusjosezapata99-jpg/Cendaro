import type { ReactNode } from "react";

import { cn } from "@cendaro/ui";

interface ProductFrameProps {
  /** Site host shown in the address bar (`siteUrl.host`, passed from a server file). */
  host: string;
  /** App path shown in the address bar, e.g. "/dashboard". */
  path: string;
  children: ReactNode;
  className?: string;
}

/**
 * 1px app-window frame around a product recording or view (DESIGN.md §7).
 * Pure (no env import) so client islands can render it; decorative chrome is
 * hidden from assistive tech, the content carries its own label.
 */
export function ProductFrame({
  host,
  path,
  children,
  className,
}: ProductFrameProps) {
  return (
    <figure className={cn("border-border bg-background border", className)}>
      <div
        aria-hidden="true"
        className="border-border bg-card flex h-9 items-center gap-1.5 border-b px-3"
      >
        <span className="bg-border size-2" />
        <span className="bg-border size-2" />
        <span className="bg-border size-2" />
        <span className="text-muted-foreground ml-3 truncate font-mono text-xs">
          {host}
          {path}
        </span>
      </div>
      {children}
    </figure>
  );
}
