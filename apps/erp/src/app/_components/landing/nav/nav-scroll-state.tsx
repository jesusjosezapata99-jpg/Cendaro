"use client";

import { useEffect } from "react";

const SCROLLED_AT = 24;

/**
 * Marks the public header once the page scrolls (`data-scrolled`), so CSS
 * alone draws its background and hairline. Passive, rAF-throttled.
 */
export function NavScrollState({ targetId }: { targetId: string }): null {
  useEffect(() => {
    const header = document.getElementById(targetId);
    if (!header) return;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      header.toggleAttribute("data-scrolled", window.scrollY > SCROLLED_AT);
    };
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return null;
}
