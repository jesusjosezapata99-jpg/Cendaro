import { siteUrl } from "~/lib/site-env";

/**
 * Shared JSON-LD helpers for the public site (plan T7.2). Kept in one place
 * so every page escapes `<` the same way (defends the embedding `<script>`
 * against a literal `</script>` inside a value, even though every value here
 * is static copy we control) and builds `BreadcrumbList` the same way.
 */

interface Crumb {
  name: string;
  /** Path from the site root, e.g. "/funciones/finanzas". */
  path: string;
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
