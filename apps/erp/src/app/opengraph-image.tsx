import { HERO } from "./_components/landing/content";
import { OG_SIZE, renderOgCard } from "./_components/landing/og/og-card";

export const alt = "Cendaro — Vende, importa y cobra desde un solo sistema";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Home social preview, same card as the feature pages (plan T7). */
export default function OGImage() {
  return renderOgCard({
    eyebrow: "ERP para distribuidoras en Venezuela",
    title: HERO.title.join(" "),
  });
}
