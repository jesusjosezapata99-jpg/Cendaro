/**
 * Cendaro — App Shell Loading Skeleton
 *
 * Provides instant visual feedback during route transitions.
 * Next.js renders this component while the target page's JS
 * chunk is downloading + the page component is suspending.
 */
export default function Loading() {
  return (
    <div className="animate-in fade-in space-y-6 p-4 duration-200 lg:p-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="bg-muted h-7 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-64 animate-pulse rounded-lg" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-4">
            <div className="bg-muted mb-2 h-3 w-20 animate-pulse rounded" />
            <div className="bg-muted h-6 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="border-border bg-card rounded-xl border p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted h-10 w-full animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
