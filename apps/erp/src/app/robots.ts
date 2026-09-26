import type { MetadataRoute } from "next";

import { env } from "~/env";
import { isIndexableDeployment } from "~/lib/site";
import { siteUrl } from "~/lib/site-env";

/**
 * Only the Vercel production deployment is indexable; previews and local
 * builds disallow everything so they never compete with the canonical site.
 * The authenticated app is excluded explicitly even though it redirects.
 */
export default function robots(): MetadataRoute.Robots {
  const isIndexable = isIndexableDeployment(env.VERCEL_ENV);
  if (!isIndexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/funciones"],
      disallow: ["/api/", "/login", "/monitoring"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
    host: siteUrl.origin,
  };
}
