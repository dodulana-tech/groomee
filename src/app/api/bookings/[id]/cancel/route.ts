import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";
import { notifyCustomerBookingCancelled } from "@/lib/whatsapp";

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
      include: { customer: true, payment: true, groomer: true },
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
        data: { status: "CANCELLED" },
      });

      if (booking.payment && refundAmount > 0) {
        await tx.payment.update({
          where: { bookingId: booking.id },
          data: { status: "REFUNDED", refundedAt: new Date(), refundAmount },
        });
      }

      if (booking.groomerId) {
        await tx.groomer.update({
          where: { id: booking.groomerId },
          data: { availability: "ONLINE", currentBookingId: null },
        });
      }
    });

    // Paystack refund (outside transaction — network call)
    if (booking.payment?.paystackRef && refundAmount > 0) {
      try {
        await createRefund({
          transaction: booking.payment.paystackRef,
          amount: refundAmount,
          reason: reason || "Customer cancellation",
        });
      } catch (refundErr) {
        console.error("Paystack refund failed:", refundErr);
        // Don't fail the whole cancel if refund API errors — handle manually
      }
    }

    // Notify customer
    try {
      await notifyCustomerBookingCancelled(
        booking.customer.phone,
        reason || "Booking cancelled",
      );
    } catch {}

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
