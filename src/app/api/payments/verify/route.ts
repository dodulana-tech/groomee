import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const payment = await db.payment.findFirst({
      where: { paystackRef: reference },
    });
    if (!payment) {
      return NextResponse.redirect(`${appUrl}/?error=payment_not_found`);
    }

    // SECURITY: Verify bookingId matches the payment record
    if (payment.bookingId !== bookingId) {
      return NextResponse.redirect(`${appUrl}/?error=payment_mismatch`);
    }

    // SECURITY: Idempotency — don't reprocess already-handled payments
    if (payment.status !== "PENDING") {
      return NextResponse.redirect(`${appUrl}/booking/${bookingId}`);
    }

    const txData = await verifyTransaction(reference);

    if (txData.status === "success") {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "AUTHORISED",
            authorisedAt: new Date(),
          },
        });

        await tx.booking.update({
          where: { id: bookingId },
          data: { status: "DISPATCHING" },
        });
      });

      // Kick off pro dispatch
      tryNextPro(bookingId).catch(console.error);

      return NextResponse.redirect(`${appUrl}/booking/${bookingId}`);
    } else {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=payment_failed`);
    }
  } catch (err) {
    console.error("payment verify error:", err);
    return NextResponse.redirect(`${appUrl}/?error=payment_error`);
  }
}
