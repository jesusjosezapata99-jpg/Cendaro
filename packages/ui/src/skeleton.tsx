import { cn } from "@cendaro/ui";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-muted animate-shimmer bg-linear-to-r from-transparent via-black/5 to-transparent bg-size-[200%_100%] dark:via-white/5",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
