import type { Metadata } from "next";

import { siteUrl } from "~/lib/site-env";
import { HERO } from "../_components/landing/content";
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
import { JsonLd } from "../_components/landing/seo";

const TITLE = "Cendaro — Vende, importa y cobra desde un solo sistema";
const DESCRIPTION =
  "ERP para distribuidoras y comercios en Venezuela: inventario, punto de venta, importaciones con IA y cobranzas en dólares y bolívares con la tasa BCV al día.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
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

/** Organization + SoftwareApplication (no offers: no public prices) + FAQPage. */
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Cendaro",
    url: siteUrl.origin,
    logo: new URL("/icon-512.png", siteUrl).href,
    areaServed: "VE",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Cendaro",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es-VE",
    description: HERO.lead,
    url: siteUrl.origin,
  },
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
