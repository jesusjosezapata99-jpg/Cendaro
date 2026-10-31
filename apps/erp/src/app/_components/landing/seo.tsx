import React from "react";

import { ERP_MODULES } from "@cendaro/validators";

import { siteUrl } from "~/lib/site-env";
import { HERO, MODULES } from "./content";
import { featureHref, MODULE_FEATURE } from "./features";
import { MEDIA } from "./media";

/**
 * Shared JSON-LD helpers for the public site (plan T7.2 & PLAN-2026-10-MAESTRO-SEO-GEO-AI-MARKETING §5.3).
 * Kept in one place so every page escapes `<` the same way (defends the
 * embedding `<script>` against a literal `</script>` inside a value) and
 * emits a connected Schema.org entity graph (`@id` references across
 * Organization, WebSite, SoftwareApplication, ItemList, and VideoObject).
 */

interface Crumb {
  name: string;
  /** Path from the site root, e.g. "/funciones/finanzas". */
  path: string;
}

/**
 * Canonical URL and hreflang alternates (`es-VE`, `es`, `x-default`) for
 * public marketing routes so Google Search serves Cendaro both in Venezuela
 * and across Spanish-language queries globally.
 */
export function marketingAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  return {
    canonical: path,
    languages: {
      "es-VE": path,
      es: path,
      "x-default": path,
    },
  };
}

export function breadcrumbJsonLd(
  trail: readonly Crumb[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: new URL(crumb.path, siteUrl).href,
    })),
  };
}

/** Canonical Organization node (`#organization`). */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": new URL("/#organization", siteUrl).href,
    name: "Cendaro",
    alternateName: "Cendaro ERP",
    url: siteUrl.origin,
    logo: {
      "@type": "ImageObject",
      url: new URL("/icon-512.png", siteUrl).href,
      width: 512,
      height: 512,
    },
    description: HERO.lead,
    areaServed: {
      "@type": "Country",
      name: "Venezuela",
      identifier: "VE",
    },
    knowsLanguage: ["es-VE", "es"],
    knowsAbout: [
      "Sistema ERP omnicanal",
      "Gestión de inventario por almacén",
      "Importación de contenedores con inteligencia artificial",
      "Punto de venta fiscal con RIF y cédula",
      "Sincronización diaria de la tasa BCV",
      "Cobranzas y cierre de caja en dólares y bolívares",
    ],
  };
}

/** Canonical WebSite node (`#website`) linked to `#organization`. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": new URL("/#website", siteUrl).href,
    name: "Cendaro",
    alternateName: ["Cendaro ERP", "Sistema ERP Cendaro"],
    description: HERO.lead,
    url: siteUrl.origin,
    inLanguage: "es-VE",
    publisher: {
      "@id": new URL("/#organization", siteUrl).href,
    },
  };
}

export interface WebPageJsonLdInput {
  /** Path from the site root, e.g. "/" or "/funciones/inventario". */
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage";
}

/**
 * WebPage / CollectionPage node connected to `#website`, `#software`, and
 * `#organization`, with `speakable` CSS selectors for Google AI / voice
 * passage extraction.
 */
export function webPageJsonLd(
  input: WebPageJsonLdInput,
): Record<string, unknown> {
  const pageUrl = new URL(input.path, siteUrl).href;
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: input.name,
    description: input.description,
    inLanguage: "es-VE",
    isPartOf: {
      "@id": new URL("/#website", siteUrl).href,
    },
    about: {
      "@id": new URL("/#software", siteUrl).href,
    },
    publisher: {
      "@id": new URL("/#organization", siteUrl).href,
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "main h2"],
    },
  };
}

/**
 * Canonical SoftwareApplication node (`#software`) with the 18 verified
 * modules in `featureList` (no `offers`: there are no public prices).
 */
export function softwareApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": new URL("/#software", siteUrl).href,
    name: "Cendaro",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Enterprise Resource Planning (ERP)",
    operatingSystem: "Web",
    inLanguage: "es-VE",
    description: HERO.lead,
    url: siteUrl.origin,
    publisher: {
      "@id": new URL("/#organization", siteUrl).href,
    },
    screenshot: new URL(MEDIA["hero-overview"].wide.dark.poster, siteUrl).href,
    featureList: ERP_MODULES.map(
      (id) => `${MODULES[id].name}: ${MODULES[id].line}`,
    ),
  };
}

/** Structured ItemList of all 18 ERP modules for `/funciones`. */
export function modulesItemListJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Módulos del sistema ERP Cendaro",
    numberOfItems: ERP_MODULES.length,
    itemListElement: ERP_MODULES.map((id, index) => {
      const info = MODULES[id];
      const slug = MODULE_FEATURE[id];
      const path = slug ? featureHref(slug) : `/funciones#${id}`;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: info.name,
        description: info.line,
        url: new URL(path, siteUrl).href,
      };
    }),
  };
}

export interface VideoJsonLdInput {
  /** Fragment or path identifier, e.g. "/#hero-video" or "/funciones/inventario#video". */
  pathId: string;
  name: string;
  description: string;
  clipId: keyof typeof MEDIA;
}

/** Structured VideoObject metadata for recorded product walkthrough clips. */
export function videoObjectJsonLd(
  input: VideoJsonLdInput,
): Record<string, unknown> {
  const clip = MEDIA[input.clipId];
  const darkMp4 =
    clip.wide.dark.videos.find((v) => v.width === 1440)?.h264 ??
    clip.wide.dark.videos[0].h264;
  const contentUrl = new URL(darkMp4, siteUrl).href;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": new URL(input.pathId, siteUrl).href,
    name: input.name,
    description: input.description,
    thumbnailUrl: [
      new URL(clip.wide.dark.poster, siteUrl).href,
      new URL(clip.wide.light.poster, siteUrl).href,
    ],
    contentUrl,
    embedUrl: contentUrl,
    width: clip.wide.width,
    height: clip.wide.height,
    uploadDate: "2026-09-25T00:00:00Z",
    inLanguage: "es-VE",
    publisher: {
      "@id": new URL("/#organization", siteUrl).href,
    },
  };
}

/** Renders one or more JSON-LD objects as a single escaped <script> tag. */
export function JsonLd({ data }: { data: readonly unknown[] | object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
