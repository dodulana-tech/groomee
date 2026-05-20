import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";
import { notifyCustomerBookingCancelled } from "@/lib/whatsapp";
import { reverseEarningsForBooking } from "@/lib/earnings-reversal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let reason = "";
    try {
      const body = await req.json();
      reason = body.reason ?? "";
    } catch {}

    const booking = await db.booking.findUnique({
      where: { id },
      include: { customer: true, payment: true, pro: true, service: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 },
      );
    }

    const isOwner = session.userId === booking.customerId;
    const isAdmin = session.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const CANCELLABLE = [
      "PENDING_PAYMENT",
      "DISPATCHING",
      "ACCEPTED",
      "EN_ROUTE",
    ];
    if (!CANCELLABLE.includes(booking.status)) {
      return NextResponse.json(
        { error: "This booking cannot be cancelled at this stage." },
        { status: 400 },
      );
    }

    // Refund logic
    let refundAmount = 0;
    const paid =
      booking.payment?.status === "AUTHORISED" ||
      booking.payment?.status === "CAPTURED";
    if (paid) {
      if (["PENDING_PAYMENT", "DISPATCHING"].includes(booking.status))
        refundAmount = booking.totalAmount;
      else if (booking.status === "ACCEPTED")
        refundAmount = booking.totalAmount * 0.9;
      else if (booking.status === "EN_ROUTE")
        refundAmount = booking.totalAmount * 0.7;
    }

    // Update DB
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      if (booking.payment && refundAmount > 0) {
        // Mark as REFUND_PENDING — actual REFUNDED status set by Paystack webhook
        await tx.payment.update({
          where: { bookingId: booking.id },
          data: { status: "REFUND_PENDING" as any, refundAmount },
        });
      }

      // Earnings clawback. Pre-existing gap: this route never touched
      // earnings, so a CONFIRMED-then-cancelled booking would leave the
      // pro's SERVICE row (and now the master's APPRENTICE_COMMISSION row)
      // intact. Reverse them all here. For statuses below CONFIRMED there
      // typically won't be any earnings rows yet, so deleteMany no-ops.
      await reverseEarningsForBooking(booking.id, 1, tx);

      if (booking.proId) {
        await tx.pro.update({
          where: { id: booking.proId },
          data: { availability: "ONLINE", currentBookingId: null },
        });
      }
    });

    // Paystack refund (outside transaction - network call)
    if (booking.payment?.paystackRef && refundAmount > 0) {
      try {
        await createRefund({
          transaction: booking.payment.paystackRef,
          amount: refundAmount,
          reason: reason || "Customer cancellation",
        });
      } catch (refundErr) {
        console.error("Paystack refund failed:", refundErr);
        // Don't fail the whole cancel if refund API errors - handle manually
      }
    }

    // Notify customer (WhatsApp + email) — phone may be null for email-only signups
    if (booking.customer.phone) {
      try {
        await notifyCustomerBookingCancelled(
          booking.customer.phone,
          reason || "Booking cancelled",
        );
      } catch {}
    }
    import("@/lib/email-notify").then(({ emailBookingCancelled }) =>
      emailBookingCancelled({
        reference: booking.reference,
        customerId: booking.customerId,
        service: { name: booking.service.name },
        refundAmount: refundAmount > 0 ? refundAmount : undefined,
      }),
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { cancelled: true, refundAmount },
    });
  } catch (err) {
    console.error("cancel booking error:", err);
    return NextResponse.json(
      { error: "Failed to cancel booking." },
      { status: 500 },
    );
  }
}
