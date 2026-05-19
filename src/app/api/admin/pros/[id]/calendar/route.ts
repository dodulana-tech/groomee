import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  bookingWindow,
  effectiveDurationMins,
  getProBookingsInRange,
  getWorkingWindow,
  travelMinsBetween,
  watDayBounds,
} from "@/lib/scheduling";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!hasPermission(session, "pros.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateStr = new URL(req.url).searchParams.get("date");
  const anchor = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const pro = await db.pro.findUnique({
    where: { id },
    select: { id: true, name: true, availability: true, status: true },
  });
  if (!pro) {
    return NextResponse.json({ error: "Pro not found" }, { status: 404 });
  }

  const { dayStart, dayEnd } = watDayBounds(anchor);
  const [work, raw] = await Promise.all([
    getWorkingWindow(pro.id, anchor),
    getProBookingsInRange(pro.id, dayStart, dayEnd),
  ]);

  // Decorate each booking with its window + travel buffer to the next.
  const blocks = await Promise.all(
    raw.map(async (b, idx) => {
      const w = bookingWindow(b);
      const next = raw[idx + 1];
      const travelToNext = next
        ? await travelMinsBetween(b.zoneId, next.zoneId)
        : 0;
      return {
        id: b.id,
        reference: b.reference,
        status: b.status,
        start: w?.start ?? null,
        end: w?.end ?? null,
        durationMins: effectiveDurationMins(b),
        service: b.service.name,
        customer: b.customer?.name ?? "Customer",
        zone: b.zone?.name ?? null,
        zoneId: b.zoneId,
        travelToNextMins: travelToNext,
      };
    }),
  );

  return NextResponse.json({
    success: true,
    data: {
      pro: { id: pro.id, name: pro.name, status: pro.status, availability: pro.availability },
      date: anchor.toISOString(),
      workingWindow: work,
      blocks,
    },
  });
}
