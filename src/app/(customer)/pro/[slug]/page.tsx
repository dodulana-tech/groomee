import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProProfileView from "@/components/customer/ProProfileView";

export default async function ProPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const pro = await db.pro.findFirst({
    where: { id: slug, status: "ACTIVE" },
    include: {
      services: { include: { service: true } },
      zones: { include: { zone: true } },
    },
  });

  if (!pro) notFound();

  // All zones for the booking panel dropdown
  const allZones = await db.zone.findMany({ orderBy: { name: "asc" } });

  const viewData = {
    id: pro.id,
    slug: pro.id,
    name: pro.name,
    photo: pro.photo ?? null,
    initials: pro.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    headline: [
      ...new Set(pro.services.map((gs: any) => gs.service.category)),
    ].join(" · "),
    specialties: pro.services.map((gs: any) => gs.service.name).slice(0, 3),
    categories: [
      ...new Set(pro.services.map((gs: any) => gs.service.category)),
    ] as string[],
    zones: pro.zones.map((gz: any) => gz.zone.name) as string[],
    avgRating: pro.avgRating,
    reviewCount: pro.reviewCount,
    totalJobs: pro.totalJobs,
    isOnline: pro.availability === "ONLINE",
    isVerified: pro.idVerified,
    bio: `Experienced beauty professional serving Lagos with ${pro.totalJobs}+ completed bookings.`,
    baseRate: pro.services[0]?.service.basePrice ?? 0,
    // Flat list for display
    services: pro.services.map((gs: any) => ({
      id: gs.service.id,
      name: gs.service.name,
      price: gs.customPrice ?? gs.service.basePrice,
      duration: `${gs.service.durationMins} min`,
    })),
    // Nested format for BookingPanel
    proServices: pro.services.map((gs: any) => ({
      service: gs.service,
      customPrice: gs.customPrice ?? null,
    })),
    // Full zone objects for BookingPanel dropdown
    allZones,
    reviews: [],
  };

  return <ProProfileView pro={viewData} />;
}
