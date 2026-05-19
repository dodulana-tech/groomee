import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Travel-time matrix CRUD. Admin-only.
//   GET  /api/admin/travel-times                 → list zones + all pairs
//   PUT  /api/admin/travel-times                 → upsert pairs (bulk)
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "settings.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [zones, pairs] = await Promise.all([
    db.zone.findMany({ orderBy: [{ city: "asc" }, { name: "asc" }] }),
    db.zoneTravel.findMany({
      orderBy: [{ fromZoneId: "asc" }, { toZoneId: "asc" }],
    }),
  ]);
  return NextResponse.json({ success: true, data: { zones, pairs } });
}

const putSchema = z.object({
  pairs: z
    .array(
      z.object({
        fromZoneId: z.string().min(1),
        toZoneId: z.string().min(1),
        travelMins: z.number().int().min(0).max(600),
        isActive: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "settings.manage_ops")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let parsed;
  try {
    parsed = putSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Reject self-pairs (zone-to-itself is implicitly 0).
  for (const p of parsed.pairs) {
    if (p.fromZoneId === p.toZoneId) {
      return NextResponse.json(
        { error: "Same-zone pairs are implicitly 0 and cannot be stored." },
        { status: 400 },
      );
    }
  }

  await db.$transaction(
    parsed.pairs.map((p) =>
      db.zoneTravel.upsert({
        where: {
          fromZoneId_toZoneId: {
            fromZoneId: p.fromZoneId,
            toZoneId: p.toZoneId,
          },
        },
        update: { travelMins: p.travelMins, isActive: p.isActive ?? true },
        create: {
          fromZoneId: p.fromZoneId,
          toZoneId: p.toZoneId,
          travelMins: p.travelMins,
          isActive: p.isActive ?? true,
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, data: { saved: parsed.pairs.length } });
}
