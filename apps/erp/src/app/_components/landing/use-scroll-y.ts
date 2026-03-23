"use client";

import { useEffect, useState } from "react";

/**
 * Hook that tracks scroll Y position for navbar behavior.
 * Returns true when scrolled past the threshold.
 */
export function useScrollY(threshold = 50): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > threshold);
    };

    // Check on mount in case page is already scrolled
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolled;
}
