import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { confirmBookingPayment } from "@/lib/booking-payment";
import { SITE_URL } from "@/lib/site";

/**
 * Paystack checkout callback. Paystack's verify API (server-to-server, with
 * our secret key) is the authority on whether the charge succeeded, so the
 * booking moves forward whether or not the browser has a Groomee session.
 * That matters for pay links sent over WhatsApp: the customer typically pays
 * from a browser that has never signed in. The session only decides where we
 * send them afterwards.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const bookingId = searchParams.get("bookingId");

  const appUrl = SITE_URL;

  if (!reference || !bookingId) {
    return NextResponse.redirect(`${appUrl}/?error=payment_failed`);
  }

  try {
    const session = await getSessionFromRequest(req);

    const payment = await db.payment.findFirst({
      where: { paystackRef: reference },
      include: { booking: { select: { customerId: true } } },
    });
    // A reference we don't hold (e.g. an older link for this booking) is
    // still checked with Paystack and matched via metadata.bookingId.
    if (payment && payment.bookingId !== bookingId) {
      return NextResponse.redirect(`${appUrl}/?error=payment_mismatch`);
    }

    // Signed-in owner lands on the booking; anyone else signs in first.
    const ownerId =
      payment?.booking.customerId ??
      (await db.booking.findUnique({ where: { id: bookingId }, select: { customerId: true } }))
        ?.customerId;
    if (!ownerId) {
      return NextResponse.redirect(`${appUrl}/?error=payment_not_found`);
    }
    const landing = (suffix = "") =>
      session?.userId === ownerId
        ? `${appUrl}/booking/${bookingId}${suffix}`
        : `${appUrl}/auth?redirect=${encodeURIComponent(`/booking/${bookingId}${suffix}`)}`;

    // Idempotency: already processed by the webhook or an earlier callback.
    if (payment && payment.status !== "PENDING" && payment.status !== "FAILED") {
      return NextResponse.redirect(landing());
    }

    const txData = await verifyTransaction(reference);

    if (txData.status === "success") {
      const metaBookingId =
        (txData as { metadata?: { bookingId?: string } }).metadata?.bookingId ?? null;
      const result = await confirmBookingPayment({
        reference,
        amountKobo: txData.amount,
        bookingIdHint: metaBookingId === bookingId ? bookingId : null,
      });
      if (!result.ok) {
        return NextResponse.redirect(
          result.reason === "AMOUNT_MISMATCH"
            ? landing("?error=amount_mismatch")
            : `${appUrl}/?error=payment_not_found`,
        );
      }
      return NextResponse.redirect(landing());
    }

    if (payment) {
      await db.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }
    return NextResponse.redirect(landing("?error=payment_failed"));
  } catch (err) {
    console.error("payment verify error:", err);
    return NextResponse.redirect(`${appUrl}/?error=payment_error`);
  }
}
