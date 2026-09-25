import type { MetadataRoute } from "next";

import { siteUrl } from "~/lib/site-env";
import { MARKETING_ROUTES } from "./_components/landing/routes";

/** Public marketing pages only (routes.ts); the app itself is never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_ROUTES.map((route) => ({
    url: new URL(route.path, siteUrl).href,
    changeFrequency: "monthly",
    priority: route.priority,
  }));
}
