import type { MetadataRoute } from "next";

import { siteUrl } from "~/lib/site-env";
import { MARKETING_ROUTES } from "./_components/landing/routes";

/**
 * Evaluated once, at build (this route is fully static — plan §5): every
 * entry gets the same `lastModified`, the build's own timestamp (plan T7.4).
 */
const BUILD_TIME = new Date();

/** Public marketing pages only (routes.ts); the app itself is never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_ROUTES.map((route) => ({
    url: new URL(route.path, siteUrl).href,
    lastModified: BUILD_TIME,
    changeFrequency: "monthly",
    priority: route.priority,
  }));
}
