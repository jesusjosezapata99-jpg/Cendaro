import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { breadcrumbJsonLd, JsonLd } from "./seo";

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
