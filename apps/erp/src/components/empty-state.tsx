import { cn } from "@cendaro/ui";

interface EmptyStateProps {
  /** Material Symbols ligature (e.g. "lock_clock"). */
  icon?: string;
  title: string;
  description?: string;
  /** Optional call-to-action (Button, Link, etc.). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard empty state for tables and panels — centered icon chip, title,
 * description, and optional action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="bg-muted text-muted-foreground material-symbols-outlined flex size-12 items-center justify-center rounded-full text-2xl"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
