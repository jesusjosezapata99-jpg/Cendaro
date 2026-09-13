import { cn } from "@cendaro/ui";

interface PageHeaderProps {
  /** Document/a11y title only — Midday shows no visible page heading. */
  title: string;
  description?: string;
  /** Left slot: search/filters (T2.11-T2.13) or other page-scoped controls. */
  children?: React.ReactNode;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page toolbar (PLAN-2026-09-MIDDAY-REDESIGN §T2.10) — no visible title;
 * `title` renders `sr-only` for accessibility and the document outline.
 * Left: description (page context, since the heading is hidden) + search/
 * filters. Right: outline actions + primary "Crear" button.
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
        "flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <h1 className="sr-only">{title}</h1>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {description ? (
          <p className="text-muted-foreground shrink-0 text-sm">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
