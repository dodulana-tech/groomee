import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";
import {
  computeEarningsSplit,
  computeEarningsSplitFromApprenticeshipId,
} from "@/lib/apprenticeships";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const booking = await db.booking.findUnique({
      where: { id },
      include: { payment: true, pro: true, service: true },
    });

    if (!booking)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.customerId !== session.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (booking.status !== "COMPLETED")
      return NextResponse.json(
        { error: "Booking is not completed yet" },
        { status: 400 },
      );
    if (!booking.proId)
      return NextResponse.json(
        { error: "No pro assigned to this booking" },
        { status: 400 },
      );

    // Compute apprenticeship split BEFORE the transaction (it does its own
    // DB reads). When non-null, the booking pro is an active apprentice and
    // we must split earnings between them and the master.
    //
    // For delegated bookings (master → apprentice mid-flow) we use the
    // snapshotted apprenticeship id so the split survives the apprentice
    // being freed between delegation and confirm. Otherwise fall back to
    // the live "active apprenticeship" lookup.
    const split = booking.delegatedApprenticeshipId
      ? await computeEarningsSplitFromApprenticeshipId(
          booking.delegatedApprenticeshipId,
          booking.proEarning,
        )
      : await computeEarningsSplit(booking.proId, booking.proEarning);

    // Atomic: conditional update prevents double-confirm race
    const confirmed = await db.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, status: "COMPLETED" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (updated.count === 0) return false; // Already confirmed by concurrent request

      if (booking.payment) {
        await tx.payment.update({
          where: { bookingId: id },
          data: { status: "CAPTURED", capturedAt: new Date() },
        });
      }

      if (split) {
        // Apprentice keeps the reduced SERVICE amount.
        await tx.earning.create({
          data: {
            proId: booking.proId!,
            bookingId: id,
            amount: split.apprenticeAmount,
            type: "SERVICE",
          },
        });
        // Master collects an APPRENTICE_COMMISSION row tagged with the
        // apprenticeship + the apprentice as sourcePro for audit/UI.
        await tx.earning.create({
          data: {
            proId: split.masterId,
            bookingId: id,
            amount: split.masterAmount,
            type: "APPRENTICE_COMMISSION",
            sourceProId: booking.proId!,
            apprenticeshipId: split.apprenticeshipId,
          },
        });
      } else {
        await tx.earning.create({
          data: {
            proId: booking.proId!,
            bookingId: id,
            amount: booking.proEarning,
            type: "SERVICE",
          },
        });
      }

      await tx.pro.update({
        where: { id: booking.proId! },
        data: {
          availability: "ONLINE",
          currentBookingId: null,
          totalJobs: { increment: 1 },
        },
      });

      return true;
    });

    if (!confirmed) {
      return NextResponse.json({ success: true }); // Idempotent — already confirmed
    }

    // Award points for booking confirmation
    await awardPoints(session.userId, POINTS.BOOKING_COMPLETION, "Booking confirmed", id).catch(() => {});

    // Send confirmation email (fire-and-forget)
    import("@/lib/email-notify").then(({ emailServiceConfirmed }) =>
      emailServiceConfirmed({
        id,
        totalAmount: booking.totalAmount,
        customerId: booking.customerId,
        service: { name: booking.service.name },
        pro: { name: booking.pro!.name },
        pointsEarned: POINTS.BOOKING_COMPLETION,
      }),
    ).catch(() => {});

    // Check for unpaid referral — award referrer on first confirmed booking
    const referral = await db.referral.findFirst({
      where: { referredUserId: session.userId, bonusPaid: false },
    });
    if (referral) {
      await db.referral.update({ where: { id: referral.id }, data: { bonusPaid: true } });
      await awardPoints(referral.referrerId, POINTS.REFERRAL, "Referral bonus", referral.id).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("confirm booking error:", err);
    return NextResponse.json(
      { error: "Failed to confirm booking" },
      { status: 500 },
    );
  }
}
