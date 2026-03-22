import type { Metadata } from "next";

import { BentoGrid } from "./_components/landing/bento-grid";
import { FAQSection } from "./_components/landing/faq-section";
import { FinalCTA } from "./_components/landing/final-cta";
import { Footer } from "./_components/landing/footer";
import { Hero } from "./_components/landing/hero";
import { IntegrationsMarquee } from "./_components/landing/integrations-marquee";
import { Navbar } from "./_components/landing/navbar";
import { PricingCards } from "./_components/landing/pricing-cards";
import { StatsSection } from "./_components/landing/stats-section";
import { StickyFeatures } from "./_components/landing/sticky-features";
import { Testimonials } from "./_components/landing/testimonials";

const SITE_URL = "https://cendaro.com";

export const metadata: Metadata = {
  title: "Cendaro — Gestión inteligente para negocios que crecen",
  description:
    "Sistema ERP omnicanal: inventario, pedidos, catálogo, facturación y analytics en un solo lugar. Empieza gratis.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Cendaro — ERP Omnicanal",
    description:
      "Gestiona inventario, pedidos y ventas sin Excel. Empieza gratis.",
    type: "website",
    locale: "es_ES",
    siteName: "Cendaro",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Cendaro — ERP Omnicanal",
    description: "Gestiona inventario, pedidos y ventas sin Excel.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* JSON-LD Structured Data */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cendaro",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Sistema ERP omnicanal: inventario, pedidos, catálogo, facturación y analytics.",
  url: SITE_URL,
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "USD",
      description: "Plan gratuito para negocios que empiezan.",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        billingDuration: "P1M",
      },
      description: "Automatización completa para negocios en crecimiento.",
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "Cendaro",
    url: SITE_URL,
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <StickyFeatures />
        <BentoGrid />
        <StatsSection />
        <Testimonials />
        <IntegrationsMarquee />
        <PricingCards />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
