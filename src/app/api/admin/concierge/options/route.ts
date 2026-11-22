import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConciergeCities } from "@/lib/cities";

// GET /api/admin/concierge/options: everything the concierge form needs.
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "bookings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const cities = await getConciergeCities();
  const cityIds = cities.map((c) => c.id);
  const [zones, services, pros] = await Promise.all([
    db.zone.findMany({
      where: { cityId: { in: cityIds } },
      select: { id: true, name: true, cityId: true },
      orderBy: { name: "asc" },
    }),
    db.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        minPrice: true,
        maxPrice: true,
        durationMins: true,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.pro.findMany({
      where: { status: "ACTIVE", zones: { some: { zone: { cityId: { in: cityIds } } } } },
      select: {
        id: true,
        name: true,
        availability: true,
        avgRating: true,
        zones: { select: { zoneId: true } },
        services: { select: { serviceId: true, customPrice: true } },
      },
      orderBy: [{ avgRating: "desc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      cities: cities.map((c) => ({ id: c.id, name: c.name, slug: c.slug, status: c.status })),
      zones,
      services,
      pros: pros.map((p) => ({
        id: p.id,
        name: p.name,
        availability: p.availability,
        avgRating: p.avgRating,
        zoneIds: p.zones.map((z) => z.zoneId),
        serviceIds: p.services.map((s) => s.serviceId),
      })),
    },
  });
}
