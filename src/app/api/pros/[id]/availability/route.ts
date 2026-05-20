import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots, getWorkingWindow } from "@/lib/scheduling";

// Customer-facing slot picker. Returns the available start times for a given
// pro, day, and chosen services. Honors:
//   - the pro's working hours
//   - existing bookings (with travel buffers from the customer's zone)
//   - MIN_BOOKING_LEAD_MINUTES setting (minimum lead time before now)
//
// Multiple services are summed into a single block — pass them as repeated
// `serviceId` params (?serviceId=a&serviceId=b) so a 1h+45m+3h chain becomes
// a 4h45m duration on the calendar.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const dateStr = sp.get("date");
  const serviceIds = sp.getAll("serviceId").filter(Boolean);
  const zoneId = sp.get("zoneId");

  if (!dateStr || serviceIds.length === 0) {
    return NextResponse.json(
      { error: "date and at least one serviceId are required" },
      { status: 400 },
    );
  }
  const anchor = new Date(dateStr);
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [pro, services, leadSetting] = await Promise.all([
    db.pro.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    }),
    db.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      select: { id: true, durationMins: true, name: true },
    }),
    db.setting.findFirst({ where: { key: "MIN_BOOKING_LEAD_MINUTES" } }),
  ]);
  if (!pro || pro.status !== "ACTIVE") {
    return NextResponse.json({ error: "Pro not available" }, { status: 404 });
  }
  if (services.length === 0) {
    return NextResponse.json({ error: "Services not found" }, { status: 404 });
  }
  const totalDurationMins = services.reduce((acc, s) => acc + s.durationMins, 0);

  const minLead = parseInt(leadSetting?.value ?? "60", 10);
  const work = await getWorkingWindow(pro.id, anchor);
  const slots = await getAvailableSlots({
    proId: pro.id,
    date: anchor,
    durationMins: totalDurationMins,
    zoneId: zoneId ?? null,
    minLeadMins: minLead,
  });

  return NextResponse.json({
    success: true,
    data: {
      proId: pro.id,
      date: anchor.toISOString(),
      durationMins: totalDurationMins,
      services: services.map((s) => ({ id: s.id, name: s.name, durationMins: s.durationMins })),
      workingWindow: work,
      slots: slots.map((s) => s.toISOString()),
    },
  });
}
