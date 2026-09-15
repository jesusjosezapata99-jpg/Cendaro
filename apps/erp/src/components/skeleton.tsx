import { Skeleton as UiSkeleton } from "@cendaro/ui";

import { Delayed } from "~/components/delayed";

export { UiSkeleton as Skeleton };

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
            <UiSkeleton className="h-7 w-48" />
            <UiSkeleton className="h-4 w-64" />
          </div>
          <UiSkeleton className="h-11 w-full sm:w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-border bg-card border p-4">
              <UiSkeleton className="mb-2 h-3 w-20" />
              <UiSkeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <UiSkeleton key={i} className="h-9 w-20" />
          ))}
        </div>
        <div className="border-border bg-card overflow-hidden border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0"
            >
              <UiSkeleton className="h-5 w-24" />
              <UiSkeleton className="h-5 flex-1" />
              <UiSkeleton className="h-5 w-20" />
              <UiSkeleton className="h-5 w-28" />
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
          <UiSkeleton className="h-8 w-56" />
          <UiSkeleton className="h-4 w-48" />
          <UiSkeleton className="mt-1 h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card flex flex-col gap-2 border p-4"
            >
              <div className="flex items-center justify-between">
                <UiSkeleton className="h-3 w-16" />
                <UiSkeleton className="size-7" />
              </div>
              <UiSkeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
        {/* Charts row — height reserved (h-64) matches the real cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-border bg-card border p-6">
              <UiSkeleton className="mb-4 h-3.5 w-32" />
              <UiSkeleton className="h-64 w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-border bg-card border p-6">
              <UiSkeleton className="mb-4 h-4 w-40" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <UiSkeleton key={j} className="h-11 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-border bg-card border p-6">
          <UiSkeleton className="mb-4 h-4 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <UiSkeleton key={i} className="mb-3 h-10 w-full" />
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
          <UiSkeleton className="h-4 w-28" />
          <UiSkeleton className="h-7 w-64" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <UiSkeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border-border bg-card border p-5 lg:col-span-2">
            <UiSkeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <UiSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div className="border-border bg-card border p-5">
            <UiSkeleton className="mb-4 h-4 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <UiSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Delayed>
  );
}
