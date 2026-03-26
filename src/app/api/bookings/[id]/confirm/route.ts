import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";

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
      include: { payment: true, pro: true },
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

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      if (booking.payment) {
        await tx.payment.update({
          where: { bookingId: id },
          data: { status: "CAPTURED", capturedAt: new Date() },
        });
      }

      if (booking.proId) {
        await tx.earning.create({
          data: {
            proId: booking.proId,
            bookingId: id,
            amount: booking.proEarning,
          },
        });

        await tx.pro.update({
          where: { id: booking.proId },
          data: {
            availability: "ONLINE",
            currentBookingId: null,
            totalJobs: { increment: 1 },
          },
        });
      }
    });

    // Award points for booking confirmation
    await awardPoints(session.userId, POINTS.BOOKING_COMPLETION, "Booking confirmed", id).catch(() => {});

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
