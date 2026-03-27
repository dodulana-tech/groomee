import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { tryNextPro } from "@/lib/dispatch";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const bookingId = searchParams.get("bookingId");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!reference || !bookingId) {
    return NextResponse.redirect(`${appUrl}/?error=payment_failed`);
  }

  try {
    // Auth: verify caller is the booking owner
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(`${appUrl}/auth?redirect=/booking/${bookingId}`);
    }

    const payment = await db.payment.findFirst({
      where: { paystackRef: reference },
      include: { booking: { select: { customerId: true } } },
    });
    if (!payment) {
      return NextResponse.redirect(`${appUrl}/?error=payment_not_found`);
    }

    // Verify bookingId matches + caller owns the booking
    if (payment.bookingId !== bookingId || payment.booking.customerId !== session.userId) {
      return NextResponse.redirect(`${appUrl}/?error=payment_mismatch`);
    }

    // Idempotency
    if (payment.status !== "PENDING") {
      return NextResponse.redirect(`${appUrl}/booking/${bookingId}`);
    }

    const txData = await verifyTransaction(reference);

    if (txData.status === "success") {
      // Verify payment amount matches (Paystack returns kobo)
      const expectedKobo = Math.round(payment.amount * 100);
      if (txData.amount !== expectedKobo) {
        console.error(`Payment amount mismatch: expected ${expectedKobo} kobo, got ${txData.amount}`);
        return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=amount_mismatch`);
      }

      // Atomic: only update if still PENDING (prevents double-processing with webhook)
      const updated = await db.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "AUTHORISED", authorisedAt: new Date() },
      });

      if (updated.count > 0) {
        await db.booking.update({
          where: { id: bookingId },
          data: { status: "DISPATCHING" },
        });
        tryNextPro(bookingId).catch(console.error);
      }

      return NextResponse.redirect(`${appUrl}/booking/${bookingId}`);
    } else {
      await db.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=payment_failed`);
    }
  } catch (err) {
    console.error("payment verify error:", err);
    return NextResponse.redirect(`${appUrl}/?error=payment_error`);
  }
}
