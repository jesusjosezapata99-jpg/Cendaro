import { cn } from "@cendaro/ui";

export type StatusTone =
  | "neutral"
  | "default"
  | "success"
  | "warning"
  | "info"
  | "orange"
  | "destructive";

const toneClasses: Record<StatusTone, string> = {
  neutral: "text-status-neutral-fg bg-status-neutral-bg",
  default: "text-status-default-fg bg-status-default-bg",
  success: "text-status-success-fg bg-status-success-bg",
  warning: "text-status-warning-fg bg-status-warning-bg",
  info: "text-status-info-fg bg-status-info-bg",
  orange: "text-status-orange-fg bg-status-orange-bg",
  destructive: "text-status-destructive-fg bg-status-destructive-bg",
};

interface StatusPillProps extends React.ComponentProps<"span"> {
  tone: StatusTone;
  /** Midday itself never uses a leading dot — off by default (§5.3). */
  dot?: boolean;
}

/** Single source of truth for status chips (§5.3) — no leading dot by
 * default, unlike the legacy `StatusBadge`. */
function StatusPill({
  tone,
  dot = false,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      data-slot="status-pill"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      <span className="line-clamp-1 truncate">{children}</span>
    </span>
  );
}

export { StatusPill };
