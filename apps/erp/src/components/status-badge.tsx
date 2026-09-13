import type { StatusTone as PillTone } from "@cendaro/ui/status-pill";
import { StatusPill } from "@cendaro/ui/status-pill";

/** @deprecated Legacy 5-tone vocabulary — new code should use
 * `StatusTone` from `@cendaro/ui/status-pill` via `~/lib/status`. Kept only
 * so the ~90 existing call sites of `StatusBadge` keep compiling until they
 * migrate (F4/F7). */
export type StatusTone =
  "neutral" | "primary" | "success" | "warning" | "destructive";

const LEGACY_TONE_MAP: Record<StatusTone, PillTone> = {
  neutral: "neutral",
  primary: "default",
  success: "success",
  warning: "warning",
  destructive: "destructive",
};

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  tone?: StatusTone;
  /** Midday never shows a dot — off by default (§5.3). */
  dot?: boolean;
}

/**
 * @deprecated Compatibility wrapper over `StatusPill` (T1.9) — pages migrate
 * to `StatusPill` + `~/lib/status` directly in F4/F7.
 */
export function StatusBadge({
  tone = "neutral",
  dot = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <StatusPill tone={LEGACY_TONE_MAP[tone]} dot={dot} {...props}>
      {children}
    </StatusPill>
  );
}
