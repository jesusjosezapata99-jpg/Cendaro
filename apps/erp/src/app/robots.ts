import type { MetadataRoute } from "next";

import { env } from "~/env";
import { isIndexableDeployment } from "~/lib/site";
import { siteUrl } from "~/lib/site-env";

/** Publicly indexable routes and assets on the production origin. */
const PUBLIC_ALLOW = [
  "/",
  "/funciones",
  "/llms.txt",
  "/llms-full.txt",
  "/opengraph-image",
  "/media/landing/",
];

/** Authenticated ERP paths and internal endpoints excluded from crawlers. */
const PRIVATE_DISALLOW = [
  "/api/",
  "/login",
  "/monitoring",
  "/dashboard",
  "/catalog",
  "/inventory",
  "/containers",
  "/pos",
  "/orders",
  "/quotes",
  "/delivery-notes",
  "/invoices",
  "/customers",
  "/vendors",
  "/pricing",
  "/rates",
  "/payments",
  "/cash-closure",
  "/accounts-receivable",
  "/marketplace",
  "/whatsapp",
  "/users",
  "/audit",
  "/reports",
  "/alerts",
  "/settings",
];

/**
 * Search engines and AI answer engines explicitly welcomed on the public
 * marketing surface (PLAN-2026-10-MAESTRO-SEO-GEO-AI-MARKETING §5.2).
 */
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Google-Extended",
  "bingbot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
];

/** Non-attributing bulk scrapers blocked across the entire origin. */
const BLOCKED_SCRAPERS = ["Bytespider", "CCBot", "Omgili"];

/**
 * Only the Vercel production deployment is indexable; previews and local
 * builds disallow everything so they never compete with the canonical site.
 */
export default function robots(): MetadataRoute.Robots {
  const isIndexable = isIndexableDeployment(env.VERCEL_ENV);
  if (!isIndexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: AI_AND_SEARCH_BOTS,
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: BLOCKED_SCRAPERS,
        disallow: "/",
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).href,
    host: siteUrl.origin,
  };
}
