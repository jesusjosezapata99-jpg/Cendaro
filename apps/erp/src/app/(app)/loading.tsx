/**
 * Cendaro — App Shell Loading Skeleton
 *
 * Provides instant visual feedback during route transitions.
 * Next.js renders this component while the target page's JS
 * chunk is downloading + the page component is suspending.
 */
export default function Loading() {
  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-muted mb-2" />
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
