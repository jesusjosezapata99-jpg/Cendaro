import { cn } from "@cendaro/ui";

export type StatusTone =
  "neutral" | "primary" | "success" | "warning" | "destructive";

/**
 * Token-based soft chips — the single source of truth for status color
 * (readable in light/dark via the *-soft text tokens).
 */
const toneStyles: Record<StatusTone, string> = {
  neutral:
    "border-border bg-muted/50 text-muted-foreground [&>span]:bg-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary [&>span]:bg-primary",
  success:
    "border-success/20 bg-success/10 text-success-soft [&>span]:bg-success",
  warning:
    "border-warning/25 bg-warning/15 text-warning-soft [&>span]:bg-warning",
  destructive:
    "border-destructive/20 bg-destructive/10 text-destructive-soft [&>span]:bg-destructive",
};

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  tone?: StatusTone;
  /** Shows a small tone-colored dot before the label (default: true). */
  dot?: boolean;
}

/**
 * Central status chip for every business state in the ERP.
 */
export function StatusBadge({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>span]:size-1.5 [&>span]:shrink-0 [&>span]:rounded-full",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden /> : null}
      {children}
    </span>
  );
}
