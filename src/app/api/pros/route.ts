import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  // ─── Apprenticeship gating (Slice 5) ───
  // A pro is shown publicly only when they're NOT an apprentice, OR when
  // they're an apprentice who has been independence-approved by their master
  // AND has cleared every required+gating curriculum module. We push the
  // filter into Prisma rather than post-filtering per row to keep the query
  // fast; the equivalent in TS lives in `canTakeIndependentBookings`.
  const independenceGate: Prisma.ProWhereInput = {
    OR: [
      { relationship: { not: "APPRENTICE" } },
      {
        relationship: "APPRENTICE",
        apprenticeshipsAsApprentice: {
          some: {
            status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] },
            masterApprovedIndependence: { not: null },
            modules: {
              none: {
                required: true,
                gatesIndependence: true,
                OR: [{ completedAt: null }, { masterSignoffAt: null }],
              },
            },
          },
        },
      },
    ],
  };

  const andClauses: Prisma.ProWhereInput[] = [
    { status: "ACTIVE" },
    independenceGate,
  ];
  if (asap) andClauses.push({ availability: "ONLINE" });
  if (serviceSlug)
    andClauses.push({ services: { some: { service: { slug: serviceSlug } } } });
  if (zoneSlug)
    andClauses.push({ zones: { some: { zone: { slug: zoneSlug } } } });
  if (minPrice !== undefined || maxPrice !== undefined) {
    andClauses.push({
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
    });
  }

  const pros = await db.pro.findMany({
    where: { AND: andClauses },
    select: {
      id: true,
      name: true,
      availability: true,
      avgRating: true,
      reviewCount: true,
      totalJobs: true,
      relationship: true,
      freedAt: true,
      parent: { select: { id: true, name: true } },
      freedUnder: { select: { id: true, name: true } },
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
