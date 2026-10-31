import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ERP_MODULES } from "@cendaro/validators";

import { FEATURE_SLUGS } from "./features";
import { buildRssFeedXml } from "./feed";
import { buildLlmsFullTxt, buildLlmsTxt } from "./llms";
import {
  breadcrumbJsonLd,
  JsonLd,
  marketingAlternates,
  modulesItemListJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  videoObjectJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "./seo";

// seo.tsx reads the site origin from the server-validated env module; the
// test only needs a fixed origin.
vi.mock("~/lib/site-env", () => ({
  siteUrl: new URL("https://example.test"),
}));

describe("breadcrumbJsonLd", () => {
  it("numbers crumbs from 1 and resolves absolute URLs", () => {
    const ld = breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Funciones", path: "/funciones" },
    ]);

    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: "https://example.test/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Funciones",
        item: "https://example.test/funciones",
      },
    ]);
  });
});

describe("Schema.org entity graph builders", () => {
  it("links Organization, WebSite and SoftwareApplication via @id", () => {
    const org = organizationJsonLd();
    const site = websiteJsonLd();
    const app = softwareApplicationJsonLd();

    expect(org["@id"]).toBe("https://example.test/#organization");
    expect(site["@id"]).toBe("https://example.test/#website");
    expect(site.publisher).toEqual({
      "@id": "https://example.test/#organization",
    });

    expect(app["@id"]).toBe("https://example.test/#software");
    expect(app.publisher).toEqual({
      "@id": "https://example.test/#organization",
    });
    expect(app.offers).toBeUndefined();
    expect(Array.isArray(app.featureList)).toBe(true);
    expect((app.featureList as string[]).length).toBe(ERP_MODULES.length);
  });

  it("builds an ItemList covering all 18 ERP modules", () => {
    const list = modulesItemListJsonLd();
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(ERP_MODULES.length);
    const items = list.itemListElement as { url: string; position: number }[];
    expect(items.length).toBe(ERP_MODULES.length);
    expect(items[0]?.position).toBe(1);
    expect(items[0]?.url).toMatch(/^https:\/\/example\.test\/funciones\//);
  });

  it("builds a valid VideoObject with absolute poster, MP4 URLs, dimensions and publisher", () => {
    const video = videoObjectJsonLd({
      pathId: "/#hero-video",
      name: "Demo Cendaro",
      description: "Recorrido general",
      clipId: "hero-overview",
    });

    expect(video["@type"]).toBe("VideoObject");
    expect(video["@id"]).toBe("https://example.test/#hero-video");
    expect(video.contentUrl).toMatch(
      /^https:\/\/example\.test\/media\/landing\/.*\.mp4$/,
    );
    expect(video.embedUrl).toBe(video.contentUrl);
    expect(video.width).toBe(1440);
    expect(video.height).toBe(900);
    expect(video.publisher).toEqual({
      "@id": "https://example.test/#organization",
    });
  });

  it("builds WebPage / CollectionPage JSON-LD connected to #website, #software and #organization", () => {
    const page = webPageJsonLd({
      path: "/funciones/inventario",
      name: "Inventario y catálogo",
      description: "Stock por almacén y canal",
    });

    expect(page["@type"]).toBe("WebPage");
    expect(page["@id"]).toBe(
      "https://example.test/funciones/inventario#webpage",
    );
    expect(page.isPartOf).toEqual({
      "@id": "https://example.test/#website",
    });
    expect(page.about).toEqual({
      "@id": "https://example.test/#software",
    });
    expect(page.publisher).toEqual({
      "@id": "https://example.test/#organization",
    });
    expect(page.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "main h2"],
    });
  });

  it("emits canonical and hreflang alternates (es-VE, es, x-default)", () => {
    expect(marketingAlternates("/funciones/finanzas")).toEqual({
      canonical: "/funciones/finanzas",
      languages: {
        "es-VE": "/funciones/finanzas",
        es: "/funciones/finanzas",
        "x-default": "/funciones/finanzas",
      },
    });
  });
});

describe("llms.txt and llms-full.txt builders", () => {
  const origin = new URL("https://example.test");

  it("emits valid llmstxt.org v2 markdown in buildLlmsTxt", () => {
    const txt = buildLlmsTxt(origin);
    expect(txt.startsWith("# Cendaro\n\n> ")).toBe(true);
    expect(txt).toContain("https://example.test/llms-full.txt");
    for (const slug of FEATURE_SLUGS) {
      expect(txt).toContain(`https://example.test/funciones/${slug}`);
    }
  });

  it("includes every feature page and module in buildLlmsFullTxt", () => {
    const full = buildLlmsFullTxt(origin);
    expect(full.startsWith("# Cendaro — Documentación Completa")).toBe(true);
    for (const slug of FEATURE_SLUGS) {
      expect(full).toContain(`https://example.test/funciones/${slug}`);
    }
  });

  it("emits valid RSS 2.0 + Google WebSub hub links in buildRssFeedXml", () => {
    const xml = buildRssFeedXml(origin, new Date("2026-09-25T00:00:00Z"));
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(
      '<atom:link href="https://pubsubhubbub.appspot.com/" rel="hub" />',
    );
    expect(xml).toContain(
      '<atom:link href="https://example.test/feed.xml" rel="self" type="application/rss+xml" />',
    );
    for (const slug of FEATURE_SLUGS) {
      expect(xml).toContain(
        `<link>https://example.test/funciones/${slug}</link>`,
      );
    }
  });
});

describe("JsonLd", () => {
  it("escapes < so a value cannot close the script tag", () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ name: "</script><b>x</b>" }} />,
    );

    expect(html).not.toContain("</script><b>");
    expect(html).toContain("\\u003c/script>");
  });

  it("emits valid JSON that round-trips", () => {
    const html = renderToStaticMarkup(<JsonLd data={[{ a: 1 }, { b: "<" }]} />);
    const body = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");

    expect(JSON.parse(body)).toEqual([{ a: 1 }, { b: "<" }]);
  });
});
