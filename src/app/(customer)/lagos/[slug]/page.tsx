import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AREAS, SERVICES, areaBySlug, serviceBySlug } from "@/lib/seo/content";
import { AreaPage, ServiceCityPage, areaMetadata, serviceMetadata } from "@/components/seo/pages";

// /lagos/<service> and /lagos/<area> share one segment; slugs never overlap.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...SERVICES.map((s) => ({ slug: s.slug })),
    ...AREAS.filter((a) => a.city === "lagos").map((a) => ({ slug: a.slug })),
  ];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (service) return serviceMetadata("lagos", service);
  const area = areaBySlug("lagos", slug);
  return area ? areaMetadata(area) : {};
}

export default async function LagosSlugPage({ params }: Props) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (service) return <ServiceCityPage city="lagos" service={service} />;
  const area = areaBySlug("lagos", slug);
  if (area) return <AreaPage area={area} />;
  notFound();
}
