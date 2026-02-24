import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import GroomerProfileView from "@/components/customer/GroomerProfileView";

export default async function GroomerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const groomer = await db.groomer.findFirst({
    where: { id: slug, status: "ACTIVE" },
    include: {
      services: { include: { service: true } },
      zones: { include: { zone: true } },
    },
  });

  if (!groomer) notFound();

  // All zones for the booking panel dropdown
  const allZones = await db.zone.findMany({ orderBy: { name: "asc" } });

  const viewData = {
    id: groomer.id,
    slug: groomer.id,
    name: groomer.name,
    initials: groomer.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    headline: [
      ...new Set(groomer.services.map((gs: any) => gs.service.category)),
    ].join(" · "),
    specialties: groomer.services.map((gs: any) => gs.service.name).slice(0, 3),
    categories: [
      ...new Set(groomer.services.map((gs: any) => gs.service.category)),
    ] as string[],
    zones: groomer.zones.map((gz: any) => gz.zone.name) as string[],
    avgRating: groomer.avgRating,
    reviewCount: groomer.reviewCount,
    totalJobs: groomer.totalJobs,
    isOnline: groomer.availability === "ONLINE",
    isVerified: groomer.idVerified,
    bio: `Professional groomer serving Lagos with ${groomer.totalJobs}+ completed jobs.`,
    baseRate: groomer.services[0]?.service.basePrice ?? 0,
    // Flat list for display
    services: groomer.services.map((gs: any) => ({
      id: gs.service.id,
      name: gs.service.name,
      price: gs.customPrice ?? gs.service.basePrice,
      duration: `${gs.service.durationMins} min`,
    })),
    // Nested format for BookingPanel
    groomerServices: groomer.services.map((gs: any) => ({
      service: gs.service,
      customPrice: gs.customPrice ?? null,
    })),
    // Full zone objects for BookingPanel dropdown
    allZones,
    reviews: [],
  };

  return <GroomerProfileView groomer={viewData} />;
}
