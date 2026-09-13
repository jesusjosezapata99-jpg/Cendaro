import { cn } from "@cendaro/ui";

import { Delayed } from "~/components/delayed";

/**
 * Base skeleton block — pulsing placeholder for loading states.
 * Size it with Tailwind classes (h-*, w-*, rounded-*).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted animate-pulse rounded-lg", className)} />;
}

/**
 * Suspense fallback shaped like the standard list pages (header, stat
 * cards, filter chips, table). Matching the final layout keeps CLS ≈ 0
 * when the prefetched content streams in. Delayed-wrapped (NN/g): loads
 * under 200 ms never flash the skeleton.
 */
export function ListPageSkeleton() {
  return (
    <Delayed>
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-11 w-full sm:w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card rounded-xl border p-4"
            >
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
          ))}
        </div>
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </Delayed>
  );
}

/**
 * Suspense fallback shaped like the dashboard (PageHeader + BCV chip,
 * 6 StatCards, two panels, full-width closures table).
 * Mirrors StatCard: p-4, label row with icon chip, value line.
 */
export function DashboardSkeleton() {
  return (
    <Delayed>
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-1 h-5 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-border-subtle surface-card flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="size-7 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
        {/* Charts row — height reserved (h-64) matches the real cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border-border-subtle surface-card rounded-xl border p-6"
            >
              <Skeleton className="mb-4 h-3.5 w-32" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border-border-subtle surface-card rounded-xl border p-6"
            >
              <Skeleton className="mb-4 h-4 w-40" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-border-subtle surface-card rounded-xl border p-6">
          <Skeleton className="mb-4 h-4 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-10 w-full" />
          ))}
        </div>
      </div>
    </Delayed>
  );
}

/**
 * Suspense fallback shaped like the [id] detail pages (title, meta row,
 * tab strip, two-column panel grid).
 */
export function DetailSkeleton() {
  return (
    <Delayed>
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border-border bg-card rounded-xl border p-5 lg:col-span-2">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div className="border-border bg-card rounded-xl border p-5">
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Delayed>
  );
}
