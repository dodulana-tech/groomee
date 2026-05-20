import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";
import { logAdminAction } from "@/lib/admin-audit";
import { reverseEarningsForBooking } from "@/lib/earnings-reversal";

// POST /api/admin/bookings/[id]/refund
//
// Issues a refund (full or partial) outside of the dispute flow. Used when
// admin needs to refund without an open dispute (goodwill refund, duplicate
// charge, etc.).
//
// Body: { amount: number, reason: string }
//   - amount: in NGN. 0 < amount <= booking.totalAmount
//   - reason: required, min 5 chars (logged + stored on payment record)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "bookings.refund")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { amount, reason } = await req.json();

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Refund amount must be a positive number" },
        { status: 400 },
      );
    }
    if (typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Please provide a refund reason (min 5 chars)." },
        { status: 400 },
      );
    }

    const booking = await db.booking.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }
    if (!booking.payment?.paystackRef) {
      return NextResponse.json(
        { success: false, error: "No Paystack payment to refund against." },
        { status: 400 },
      );
    }
    if (amount > booking.totalAmount) {
      return NextResponse.json(
        { success: false, error: "Refund cannot exceed the booking total." },
        { status: 400 },
      );
    }
    const previousRefund = booking.payment.refundAmount ?? 0;
    if (previousRefund + amount > booking.totalAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Already refunded ${previousRefund}; cannot refund another ${amount}.`,
        },
        { status: 400 },
      );
    }

    // Trigger the Paystack refund first — if it fails we don't want a
    // refunded record in our DB without a real refund attached.
    let paystackOk = true;
    let paystackError: string | null = null;
    try {
      await createRefund({
        transaction: booking.payment.paystackRef,
        amount,
        reason: reason.trim(),
      });
    } catch (err) {
      paystackOk = false;
      paystackError = err instanceof Error ? err.message : "Paystack refund failed";
      console.error("admin refund: Paystack call failed", err);
    }

    if (!paystackOk) {
      return NextResponse.json(
        {
          success: false,
          error: `Refund could not be processed by Paystack: ${paystackError}`,
        },
        { status: 502 },
      );
    }

    // Refund clawback: reverse the earnings rows attached to this booking.
    // Full refund (cumulative refund hits totalAmount) → delete every Earning
    // row (apprentice SERVICE + master APPRENTICE_COMMISSION when present).
    // Partial refund → scale every Earning amount down proportionally so
    // both apprentice and master take the haircut. Same helper, same math.
    const refundFraction = Math.min(1, amount / booking.totalAmount);
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: booking.payment!.id },
        data: {
          refundAmount: previousRefund + amount,
          status:
            previousRefund + amount >= booking.totalAmount
              ? "REFUNDED"
              : booking.payment!.status,
        },
      });
      await tx.note.create({
        data: {
          entityType: "booking",
          entityId: id,
          authorId: session!.userId,
          content: `Refund: ₦${amount.toLocaleString()} — ${reason.trim()}`,
        },
      });
      await reverseEarningsForBooking(id, refundFraction, tx);
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "booking.refund",
      entityType: "booking",
      entityId: id,
      metadata: { amount, reason: reason.trim(), bookingTotal: booking.totalAmount },
    });

    return NextResponse.json({ success: true, data: { refunded: amount } });
  } catch (err) {
    console.error("admin booking refund error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process refund" },
      { status: 500 },
    );
  }
}
