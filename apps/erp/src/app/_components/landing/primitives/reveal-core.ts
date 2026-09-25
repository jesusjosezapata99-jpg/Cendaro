/**
 * Reveal controller (PLAN-2026-09-LANDING-REDESIGN §4.4) — framework-free so
 * it is unit-testable in node. One observer for the whole page: every
 * `[data-reveal]` element is observed once, marked `data-inview` when it
 * enters the viewport, then released.
 */

export const REVEAL_ATTR = "data-reveal";
export const INVIEW_ATTR = "data-inview";
export const READY_ATTR = "data-reveal-ready";

/** Reveal a little before the element is fully on screen. */
export const REVEAL_OBSERVER_OPTIONS = {
  rootMargin: "0px 0px -8% 0px",
  threshold: 0.12,
} as const;

export interface RevealTarget {
  setAttribute(name: string, value: string): void;
  hasAttribute(name: string): boolean;
}

export interface RevealEntry<T extends RevealTarget> {
  target: T;
  isIntersecting: boolean;
}

export interface ObserverLike<T extends RevealTarget> {
  observe(target: T): void;
  unobserve(target: T): void;
  disconnect(): void;
}

export type ObserverFactory<T extends RevealTarget> = (
  callback: (entries: readonly RevealEntry<T>[]) => void,
  options: typeof REVEAL_OBSERVER_OPTIONS,
) => ObserverLike<T>;

export interface RevealController<T extends RevealTarget> {
  /** Observe targets not revealed or tracked yet (safe to call repeatedly). */
  track(targets: Iterable<T>): void;
  disconnect(): void;
}

export function createRevealController<T extends RevealTarget>(
  factory: ObserverFactory<T>,
): RevealController<T> {
  const tracked = new Set<T>();

  const observer = factory((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.setAttribute(INVIEW_ATTR, "true");
      observer.unobserve(entry.target);
      tracked.delete(entry.target);
    }
  }, REVEAL_OBSERVER_OPTIONS);

  return {
    track(targets) {
      for (const target of targets) {
        if (tracked.has(target) || target.hasAttribute(INVIEW_ATTR)) continue;
        tracked.add(target);
        observer.observe(target);
      }
    },
    disconnect() {
      tracked.clear();
      observer.disconnect();
    },
  };
}
