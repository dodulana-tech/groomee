import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/utils";

async function currentPro(userId: string) {
  return db.pro.findFirst({ where: { userId }, select: { id: true } });
}

// GET /api/partner/services — the full active catalog plus what this pro
// offers and at what price, so they can price and add/remove services.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const pro = await currentPro(session.userId);
  if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });

  const [catalog, mine] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        minPrice: true,
        maxPrice: true,
        durationMins: true,
      },
    }),
    db.proService.findMany({ where: { proId: pro.id }, select: { serviceId: true, customPrice: true } }),
  ]);
  const byId = new Map(mine.map((m) => [m.serviceId, m.customPrice] as const));
  return NextResponse.json({
    success: true,
    data: catalog.map((s) => ({
      ...s,
      offered: byId.has(s.id),
      customPrice: byId.get(s.id) ?? null,
    })),
  });
}

const putSchema = z.object({
  services: z
    .array(z.object({ serviceId: z.string().min(1), price: z.number().positive() }))
    .min(1, "Offer at least one service so customers can book you.")
    .max(100),
});

// PUT /api/partner/services { services: [{ serviceId, price }] }
// Replaces the pro's offered services. Prices must sit inside each service's
// fair range so customers never see surprise pricing.
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const pro = await currentPro(session.userId);
  if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }
  const wanted = new Map(parsed.data.services.map((s) => [s.serviceId, Math.round(s.price)] as const));
  const records = await db.service.findMany({
    where: { id: { in: [...wanted.keys()] }, isActive: true },
    select: { id: true, name: true, minPrice: true, maxPrice: true },
  });
  if (records.length !== wanted.size) {
    return NextResponse.json(
      { success: false, error: "One of those services is no longer available. Refresh and try again." },
      { status: 400 },
    );
  }
  for (const r of records) {
    const price = wanted.get(r.id)!;
    if (price < r.minPrice || price > r.maxPrice) {
      return NextResponse.json(
        {
          success: false,
          error: `${r.name} must be priced between ${formatNaira(r.minPrice)} and ${formatNaira(r.maxPrice)}.`,
          serviceId: r.id,
        },
        { status: 400 },
      );
    }
  }

  await db.$transaction([
    db.proService.deleteMany({ where: { proId: pro.id, serviceId: { notIn: [...wanted.keys()] } } }),
    ...records.map((r) =>
      db.proService.upsert({
        where: { proId_serviceId: { proId: pro.id, serviceId: r.id } },
        create: { proId: pro.id, serviceId: r.id, customPrice: wanted.get(r.id)! },
        update: { customPrice: wanted.get(r.id)! },
      }),
    ),
  ]);
  return NextResponse.json({ success: true });
}
