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
        include: {
          service: { select: { durationMins: true } },
          payment: { select: { status: true } },
        },
      }),
      db.pro.findUnique({ where: { id: proId } }),
    ]);

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!pro)
      return NextResponse.json({ error: "Pro not found" }, { status: 404 });

    // Only before the job starts. Once a pro is on the way or working, a
    // switch needs a cancel-and-rebook so money and messages stay correct.
    const ASSIGNABLE = ["PENDING_PAYMENT", "DISPATCHING", "NO_GROOMER", "ACCEPTED"];
    if (!ASSIGNABLE.includes(booking.status)) {
      return NextResponse.json(
        { error: `Can't change the pro once a booking is ${booking.status.toLowerCase().replace("_", " ")}.`, code: "NOT_ASSIGNABLE" },
        { status: 409 },
      );
    }
    const paid = booking.payment?.status === "AUTHORISED" || booking.payment?.status === "CAPTURED";
    const previousProId = booking.proId && booking.proId !== proId ? booking.proId : null;

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

    // Unpaid: record the pro only. confirmBookingPayment offers the job to
    // them first once the customer pays. Nothing is released to a wallet
    // for a booking nobody has paid for.
    if (!paid) {
      await db.booking.update({ where: { id }, data: { proId } });
      await logAdminAction({
        adminId: session!.userId,
        action: "booking.preassign",
        entityType: "booking",
        entityId: id,
        metadata: { proId, proName: pro.name, previousStatus: booking.status },
      });
      return NextResponse.json({ success: true, preassigned: true });
    }

    if (previousProId) {
      // The delegate transfer's idempotency keys are per booking and pro,
      // so a second switch could pay a pro twice. One switch is enough in
      // practice; beyond that, cancel and rebook.
      const priorSwitch = await db.walletLedger.findFirst({
        where: { bookingId: id, type: "CLAWBACK", idempotencyKey: { startsWith: `delegate:${id}:` } },
        select: { id: true },
      });
      if (priorSwitch) {
        return NextResponse.json(
          { error: "This booking has already been moved to another pro once. Cancel it and create a new booking to switch again.", code: "ALREADY_REASSIGNED" },
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
      const wallet = await import("@/lib/wallet-releases");
      if (previousProId) {
        // Free the previous pro and move the mobilization they were paid.
        await tx.pro.updateMany({
          where: { id: previousProId, currentBookingId: id },
          data: { availability: "ONLINE", currentBookingId: null },
        });
        await wallet.transferMobilizationOnDelegate(id, previousProId, proId, tx);
      } else {
        // Same release as a dispatch acceptance (idempotent per pro).
        await wallet.releaseMobilization(id, tx);
      }
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
