import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import {
  effectiveDurationMins,
  findConflict,
  inWorkingHours,
} from "@/lib/scheduling";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, "bookings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { proId, force } = (await req.json()) as {
      proId?: string;
      force?: boolean;
    };
    if (!proId)
      return NextResponse.json(
        { error: "proId required" },
        { status: 400 },
      );

    const [booking, pro] = await Promise.all([
      db.booking.findUnique({
        where: { id },
        include: { service: { select: { durationMins: true } } },
      }),
      db.pro.findUnique({ where: { id: proId } }),
    ]);

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!pro)
      return NextResponse.json({ error: "Pro not found" }, { status: 404 });

    // ─── Scheduler enforcement ───
    // Skip checks when the booking is ASAP (live dispatch state, not on the
    // calendar) or has no scheduled time. `force=true` lets admin override.
    if (booking.scheduledFor && !booking.isAsap && !force) {
      const durationMins = effectiveDurationMins({
        durationMins: booking.durationMins,
        service: { durationMins: booking.service.durationMins },
      });
      const start = new Date(booking.scheduledFor);
      const end = new Date(start.getTime() + durationMins * 60_000);

      const withinHours = await inWorkingHours({ proId, start, end });
      if (!withinHours) {
        return NextResponse.json(
          {
            error:
              "Outside this pro's working hours. Pass {force:true} to override.",
            code: "OUT_OF_HOURS",
          },
          { status: 409 },
        );
      }
      const hit = await findConflict({
        proId,
        start,
        end,
        zoneId: booking.zoneId,
        excludeBookingId: id,
      });
      if (hit.conflict) {
        return NextResponse.json(
          {
            error: hit.reason,
            code: "SCHEDULE_CONFLICT",
            withBookingId: hit.withBookingId,
          },
          { status: 409 },
        );
      }
    }

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { proId, status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.pro.update({
        where: { id: proId },
        data: { availability: "BUSY", currentBookingId: id },
      });
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "booking.assign",
      entityType: "booking",
      entityId: id,
      metadata: { proId, proName: pro.name, previousStatus: booking.status },
    });

    // Fire-and-forget care-notes email — same gate as dispatch path.
    import("@/lib/health-notify")
      .then(({ notifyProCareNotes }) => notifyProCareNotes(id))
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("assign pro error:", err);
    return NextResponse.json(
      { error: "Failed to assign pro" },
      { status: 500 },
    );
  }
}
