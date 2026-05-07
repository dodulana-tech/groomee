import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProProfileView from "@/components/customer/ProProfileView";
import { canTakeIndependentBookings } from "@/lib/apprenticeships";

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
      parent: { select: { id: true, name: true } },
      freedUnder: { select: { id: true, name: true, freedomCertCode: true } },
    },
  });

  if (!pro) notFound();

  // Independence gate — apprentices who haven't cleared their gating modules &
  // master sign-off can't take direct bookings; we surface a "via master" CTA.
  const canTakeIndependent = await canTakeIndependentBookings(pro.id);

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
    // ─── Apprenticeship lineage (Slice 5) ───
    relationship: pro.relationship,
    parent: pro.parent
      ? { id: pro.parent.id, name: pro.parent.name, slug: pro.parent.id }
      : null,
    freedUnder: pro.freedUnder
      ? {
          id: pro.freedUnder.id,
          name: pro.freedUnder.name,
          freedomCertCode: pro.freedUnder.freedomCertCode ?? null,
        }
      : null,
    freedAt: pro.freedAt,
    freedomCertCode: pro.freedomCertCode ?? null,
    canTakeIndependent,
    reviews: await db.review.findMany({
      where: { booking: { proId: pro.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        rating: true,
        text: true,
        createdAt: true,
        booking: { select: { customer: { select: { name: true } } } },
      },
    }).then((reviews) =>
      reviews.map((r) => ({
        author: r.booking.customer.name ?? "Customer",
        rating: r.rating,
        text: r.text ?? "",
        date: r.createdAt.toLocaleDateString("en-NG", { month: "short", year: "numeric" }),
      })),
    ),
  };

  return <ProProfileView pro={viewData} />;
}
