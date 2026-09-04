import { cn } from "@cendaro/ui";

/**
 * Base skeleton block — pulsing placeholder for loading states.
 * Size it with Tailwind classes (h-*, w-*, rounded-*).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted animate-pulse rounded-lg", className)} />;
}
