import { notFound } from "next/navigation";

import {
  FEATURE_SLUGS,
  FEATURES,
  isFeatureSlug,
} from "../../../_components/landing/features";
import { OG_SIZE, renderOgCard } from "../../../_components/landing/og/og-card";

export const alt = "Cendaro — funciones";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams(): { slug: string }[] {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  const page = FEATURES[slug];
  return renderOgCard({ eyebrow: page.eyebrow, title: page.title });
}
