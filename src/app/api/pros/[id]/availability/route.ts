import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots, getWorkingWindow } from "@/lib/scheduling";

// Customer-facing slot picker. Returns the available start times for a given
// pro, day, and service. Honors:
//   - the pro's working hours
//   - existing bookings (with travel buffers from the customer's zone)
//   - MIN_BOOKING_LEAD_MINUTES setting (minimum lead time before now)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const dateStr = sp.get("date");
  const serviceId = sp.get("serviceId");
  const zoneId = sp.get("zoneId");

  if (!dateStr || !serviceId) {
    return NextResponse.json(
      { error: "date and serviceId are required" },
      { status: 400 },
    );
  }
  const anchor = new Date(dateStr);
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [pro, service, leadSetting] = await Promise.all([
    db.pro.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    }),
    db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMins: true, name: true },
    }),
    db.setting.findFirst({ where: { key: "MIN_BOOKING_LEAD_MINUTES" } }),
  ]);
  if (!pro || pro.status !== "ACTIVE") {
    return NextResponse.json({ error: "Pro not available" }, { status: 404 });
  }
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const minLead = parseInt(leadSetting?.value ?? "60", 10);
  const work = await getWorkingWindow(pro.id, anchor);
  const slots = await getAvailableSlots({
    proId: pro.id,
    date: anchor,
    durationMins: service.durationMins,
    zoneId: zoneId ?? null,
    minLeadMins: minLead,
  });

  return NextResponse.json({
    success: true,
    data: {
      proId: pro.id,
      date: anchor.toISOString(),
      durationMins: service.durationMins,
      workingWindow: work,
      slots: slots.map((s) => s.toISOString()),
    },
  });
}
