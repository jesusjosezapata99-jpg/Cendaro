import { cn } from "@cendaro/ui";

/** Stroke-based loading indicator (§5.9) — 1.5px stroke, spins via `animate-spin`. */
function Spinner({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("text-muted-foreground animate-spin", className)}
      role="status"
      aria-label="Cargando"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Spinner };
