import type { Metadata } from "next";

import { HERO, HERO_VIDEO_LABEL } from "../_components/landing/content";
import { BeforeAfter } from "../_components/landing/home/before-after";
import { DualCurrency } from "../_components/landing/home/dual-currency";
import { faqJsonLd, FaqSection } from "../_components/landing/home/faq-section";
import { FinalCta } from "../_components/landing/home/final-cta";
import { Hero } from "../_components/landing/home/hero";
import { HowItWorks } from "../_components/landing/home/how-it-works";
import { ModulesGrid } from "../_components/landing/home/modules-grid";
import { PlansSection } from "../_components/landing/home/plans-section";
import { ProofStrip } from "../_components/landing/home/proof-strip";
import { SecuritySection } from "../_components/landing/home/security-section";
import {
  JsonLd,
  marketingAlternates,
  organizationJsonLd,
  softwareApplicationJsonLd,
  videoObjectJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "../_components/landing/seo";

const TITLE = "Cendaro — Vende, importa y cobra desde un solo sistema";
const DESCRIPTION =
  "ERP para distribuidoras y comercios en Venezuela: inventario, punto de venta, importaciones con IA y cobranzas en dólares y bolívares con la tasa BCV al día.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "ERP Venezuela",
    "sistema administrativo Venezuela",
    "ERP para distribuidoras",
    "sistema para importadoras Venezuela",
    "inventario multi-almacén",
    "tasa BCV automática",
    "facturación dólares y bolívares",
    "punto de venta RIF Venezuela",
    "packing list con IA",
    "cuentas por cobrar bimoneda",
    "Cendaro",
  ],
  alternates: marketingAlternates("/"),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "es_VE",
    siteName: "Cendaro",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/** Organization + WebSite + WebPage + SoftwareApplication + VideoObject + FAQPage. */
const JSON_LD = [
  organizationJsonLd(),
  websiteJsonLd(),
  webPageJsonLd({
    path: "/",
    name: TITLE,
    description: DESCRIPTION,
  }),
  softwareApplicationJsonLd(),
  videoObjectJsonLd({
    pathId: "/#hero-video",
    name: `${HERO.title.join(" ")} — Demostración de Cendaro ERP`,
    description: HERO_VIDEO_LABEL,
    clipId: "hero-overview",
  }),
  faqJsonLd(),
];

export default function LandingPage() {
  return (
    <>
      <JsonLd data={JSON_LD} />
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <DualCurrency />
      <ModulesGrid />
      <BeforeAfter />
      <SecuritySection />
      <PlansSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
