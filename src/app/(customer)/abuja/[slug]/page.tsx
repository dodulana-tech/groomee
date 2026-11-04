import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AREAS, SERVICES, areaBySlug, serviceBySlug } from "@/lib/seo/content";
import { AreaPage, ServiceCityPage, areaMetadata, serviceMetadata } from "@/components/seo/pages";

// /abuja/<service> and /abuja/<area> share one segment; slugs never overlap.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...SERVICES.map((s) => ({ slug: s.slug })),
    ...AREAS.filter((a) => a.city === "abuja").map((a) => ({ slug: a.slug })),
  ];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (service) return serviceMetadata("abuja", service);
  const area = areaBySlug("abuja", slug);
  return area ? areaMetadata(area) : {};
}

export default async function AbujaSlugPage({ params }: Props) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (service) return <ServiceCityPage city="abuja" service={service} />;
  const area = areaBySlug("abuja", slug);
  if (area) return <AreaPage area={area} />;
  notFound();
}
