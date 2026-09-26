import { FACTS } from "../../_components/landing/content";
import { OG_SIZE, renderOgCard } from "../../_components/landing/og/og-card";

export const alt = "Cendaro — funciones";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    eyebrow: "Funciones",
    title: `Los ${FACTS.modules} módulos de Cendaro, en un solo sistema`,
  });
}
