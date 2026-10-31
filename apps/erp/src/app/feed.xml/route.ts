import { siteUrl } from "~/lib/site-env";
import { buildRssFeedXml } from "../_components/landing/feed";

/** Evaluated once at build time so `/feed.xml` is statically prerendered. */
const BUILD_TIME = new Date();

/**
 * Static `/feed.xml` RSS 2.0 + WebSub route.
 * Paired with `https://pubsubhubbub.appspot.com/` so Googlebot receives
 * real-time push notifications whenever a new build is deployed.
 */
export function GET(): Response {
  return new Response(buildRssFeedXml(siteUrl, BUILD_TIME), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
}
