import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeaturePage } from "../../../_components/landing/feature-page/feature-page";
import {
  FEATURE_SLUGS,
  featureHref,
  FEATURES,
  isFeatureSlug,
} from "../../../_components/landing/features";
import { faqJsonLd } from "../../../_components/landing/home/faq-section";
import { breadcrumbJsonLd, JsonLd } from "../../../_components/landing/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

/** The three feature pages are prerendered at build (plan §4.1). */
export function generateStaticParams(): { slug: string }[] {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) return {};
  const page = FEATURES[slug];
  const url = featureHref(slug);

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: "website",
      locale: "es_VE",
      siteName: "Cendaro",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function FeatureRoute({ params }: Props) {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  const page = FEATURES[slug];

  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Funciones", path: "/funciones" },
      { name: page.name, path: featureHref(slug) },
    ]),
    faqJsonLd(page.faq),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <FeaturePage page={page} />
    </>
  );
}
