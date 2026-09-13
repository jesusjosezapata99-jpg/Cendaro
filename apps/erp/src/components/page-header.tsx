import { cn } from "@cendaro/ui";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Meta content under the title (e.g. BCV rate badge). */
  children?: React.ReactNode;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page heading for every ERP section — title (semibold, tight),
 * optional description, and an actions slot aligned right on desktop.
 */
export function PageHeader({
  title,
  description,
  children,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-foreground text-2xl font-medium tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
