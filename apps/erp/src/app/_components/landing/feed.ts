import { FACTS, HERO } from "./content";
import { FEATURE_SLUGS, featureHref, FEATURES } from "./features";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds an RSS 2.0 + Atom + Google WebSub (`pubsubhubbub.appspot.com`) feed
 * covering all public marketing routes (`MARKETING_ROUTES`) and `llms-full.txt`.
 *
 * Google Search Central supports RSS 2.0 / Atom feeds alongside XML sitemaps
 * and uses the WebSub hub (`rel="hub"`) for real-time push discovery when new
 * pages or updates are deployed.
 */
export function buildRssFeedXml(
  origin: URL,
  lastModified: Date = new Date("2026-09-25T00:00:00Z"),
): string {
  const pubDate = lastModified.toUTCString();
  const feedUrl = new URL("/feed.xml", origin).href;
  const homeUrl = new URL("/", origin).href;
  const funcionesUrl = new URL("/funciones", origin).href;

  const items: {
    title: string;
    link: string;
    description: string;
  }[] = [
    {
      title: `Cendaro — ${HERO.title.join(" ")}`,
      link: homeUrl,
      description: HERO.lead,
    },
    {
      title: `Funciones: los ${FACTS.modules} módulos de Cendaro`,
      link: funcionesUrl,
      description:
        "Inventario, importaciones con IA, punto de venta, pedidos, tasas BCV, cobranzas, WhatsApp y permisos por rol, en un solo sistema para distribuidoras en Venezuela.",
    },
    ...FEATURE_SLUGS.map((slug) => {
      const page = FEATURES[slug];
      return {
        title: page.metaTitle,
        link: new URL(featureHref(slug), origin).href,
        description: page.metaDescription,
      };
    }),
  ];

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${escapeXml(pubDate)}</pubDate>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cendaro — Sistema ERP Omnicanal en Venezuela</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>${escapeXml(HERO.lead)}</description>
    <language>es-VE</language>
    <lastBuildDate>${escapeXml(pubDate)}</lastBuildDate>
    <atom:link href="https://pubsubhubbub.appspot.com/" rel="hub" />
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;
}
