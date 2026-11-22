import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PRIORITY_ZONES } from "@/lib/pro-onboarding";
import { isWhatsAppChannelCity } from "@/lib/whatsapp-channel";

async function currentPro(userId: string) {
  return db.pro.findFirst({ where: { userId }, select: { id: true } });
}

// GET /api/partner/zones — every bookable zone + the ones this pro covers.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const pro = await currentPro(session.userId);
  if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });

  const [zones, mine] = await Promise.all([
    db.zone.findMany({
      select: { id: true, name: true, city: true, cityRel: { select: { name: true, slug: true, status: true } } },
      orderBy: { name: "asc" },
    }),
    db.proZone.findMany({ where: { proId: pro.id }, select: { zoneId: true } }),
  ]);
  const covered = new Set(mine.map((m) => m.zoneId));
  const priority = new Set<string>(PRIORITY_ZONES);
  return NextResponse.json({
    success: true,
    data: zones
      .filter((z) => !z.cityRel || z.cityRel.status !== "HIDDEN")
      .map((z) => ({
        id: z.id,
        name: z.name,
        city: z.cityRel?.name ?? z.city,
        priority: priority.has(z.name) || isWhatsAppChannelCity(z.cityRel?.slug),
        covered: covered.has(z.id),
      })),
  });
}

const putSchema = z.object({
  zoneIds: z.array(z.string().min(1)).min(1, "Pick at least one area so we can send you jobs.").max(50),
});

// PUT /api/partner/zones { zoneIds }
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const pro = await currentPro(session.userId);
  if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }
  const zones = await db.zone.findMany({ where: { id: { in: parsed.data.zoneIds } }, select: { id: true } });
  if (zones.length === 0) {
    return NextResponse.json({ success: false, error: "Pick at least one area so we can send you jobs." }, { status: 400 });
  }
  await db.$transaction([
    db.proZone.deleteMany({ where: { proId: pro.id } }),
    db.proZone.createMany({ data: zones.map((z) => ({ proId: pro.id, zoneId: z.id })), skipDuplicates: true }),
  ]);
  return NextResponse.json({ success: true });
}
