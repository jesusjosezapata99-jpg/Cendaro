"use client";

import { useEffect } from "react";

import {
  createRevealController,
  INVIEW_ATTR,
  READY_ATTR,
  REVEAL_ATTR,
} from "./reveal-core";

const SELECTOR = `[${REVEAL_ATTR}]:not([${INVIEW_ATTR}])`;

/**
 * The one IntersectionObserver behind every `<Reveal>` on the public site.
 * Mounted once by the marketing layout; a MutationObserver picks up content
 * that streams in or appears after a client navigation.
 */
export function RevealObserver(): null {
  useEffect(() => {
    const root = document.documentElement;

    if (!("IntersectionObserver" in window)) {
      for (const el of document.querySelectorAll(SELECTOR)) {
        el.setAttribute(INVIEW_ATTR, "true");
      }
      root.setAttribute(READY_ATTR, "");
      return;
    }

    const controller = createRevealController<Element>(
      (callback, options) => new IntersectionObserver(callback, options),
    );
    const scan = (): void =>
      controller.track(document.querySelectorAll(SELECTOR));

    scan();
    root.setAttribute(READY_ATTR, "");

    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      controller.disconnect();
    };
  }, []);

  return null;
}
