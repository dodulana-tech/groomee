import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceSlug = searchParams.get("service");
  const zoneSlug = searchParams.get("zone");
  const asap = searchParams.get("asap") === "true";
  const take = parseInt(searchParams.get("take") ?? "20");
  const minPrice = searchParams.get("minPrice")
    ? parseInt(searchParams.get("minPrice")!)
    : undefined;
  const maxPrice = searchParams.get("maxPrice")
    ? parseInt(searchParams.get("maxPrice")!)
    : undefined;

  const pros = await db.pro.findMany({
    where: {
      status: "ACTIVE",
      ...(asap ? { availability: "ONLINE" } : {}),
      ...(serviceSlug
        ? { services: { some: { service: { slug: serviceSlug } } } }
        : {}),
      ...(zoneSlug ? { zones: { some: { zone: { slug: zoneSlug } } } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            services: {
              some: {
                service: {
                  basePrice: {
                    ...(minPrice !== undefined ? { gte: minPrice } : {}),
                    ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
                  },
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      availability: true,
      avgRating: true,
      reviewCount: true,
      totalJobs: true,
      services: {
        include: {
          service: {
            select: { name: true, basePrice: true, slug: true, category: true },
          },
        },
        ...(serviceSlug ? { where: { service: { slug: serviceSlug } } } : {}),
        take: 4,
      },
      zones: { include: { zone: { select: { name: true } } }, take: 2 },
    },
    orderBy: [
      { availability: "asc" },
      { avgRating: "desc" },
      { reviewCount: "desc" },
    ],
    take,
  });

  return NextResponse.json({ success: true, data: pros }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
