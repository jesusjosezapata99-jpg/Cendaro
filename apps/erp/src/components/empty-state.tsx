import type { IconName } from "@cendaro/ui/icons";
import { cn } from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

interface EmptyStateProps {
  icon?: IconName;
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
          className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full"
        >
          <Icon name={icon} className="size-6" />
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
