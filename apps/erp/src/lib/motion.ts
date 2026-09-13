/** Shared motion vocabulary (PLAN-2026-09-MIDDAY-REDESIGN §5.7/T1.11). */

export const easeStandard = [0.4, 0, 0.2, 1] as const;
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const springStack = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 1.2,
} as const;
