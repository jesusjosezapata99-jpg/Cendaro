import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { siteUrl } from "~/lib/site-env";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Colors of the dark theme (tooling/tailwind/theme.css). ImageResponse
 * cannot read CSS variables, so the values the card needs are repeated
 * here as rgb().
 */
const INK = "rgb(10, 10, 10)";
const PAPER = "rgb(250, 250, 250)";
const MUTED = "rgb(163, 163, 163)";
const RULE = "rgb(38, 38, 38)";

interface OgCardProps {
  eyebrow: string;
  title: string;
}

/**
 * Font and logo, read from disk once. `"use cache"` marks the file reads as
 * cacheable so, under Cache Components, the images are prerendered at build
 * instead of rendered per request. Base64 strings keep the result
 * serializable.
 */
async function loadOgAssets(): Promise<{ font: string; logo: string }> {
  "use cache";
  const root = process.cwd();
  const [font, logo] = await Promise.all([
    readFile(join(root, "assets/fonts/HedvigLettersSerif.ttf")),
    readFile(join(root, "public/icon-192.png")),
  ]);
  return { font: font.toString("base64"), logo: logo.toString("base64") };
}

/**
 * Social preview in the site's editorial style: Hedvig Serif 400 on ink,
 * 1px rules, no color (DESIGN.md §6). Font and logo come from disk — a
 * network fetch at build time is what left the old card without its logo.
 */
export async function renderOgCard({
  eyebrow,
  title,
}: OgCardProps): Promise<ImageResponse> {
  const assets = await loadOgAssets();
  const font = Buffer.from(assets.font, "base64");
  const logoSrc = `data:image/png;base64,${assets.logo}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: INK,
        color: PAPER,
        fontFamily: "Hedvig",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* ImageResponse (Satori) renders plain <img>; next/image cannot run here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={44} height={44} />
        <span style={{ fontSize: 30 }}>Cendaro</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            marginTop: 24,
            fontSize: 76,
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            maxWidth: 1000,
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 24,
          borderTop: `1px solid ${RULE}`,
          fontSize: 24,
          color: MUTED,
        }}
      >
        <span>{siteUrl.host}</span>
        <span>Hecho en Venezuela</span>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [{ name: "Hedvig", data: font, weight: 400, style: "normal" }],
    },
  );
}
