import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import { tryNextGroomer } from "@/lib/dispatch";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const bookingId = searchParams.get("bookingId");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!reference || !bookingId) {
    return NextResponse.redirect(`${appUrl}/?error=payment_failed`);
  }

  try {
    const txData = await verifyTransaction(reference);

    const payment = await db.payment.findFirst({
      where: { paystackRef: reference },
    });
    if (!payment) {
      return NextResponse.redirect(`${appUrl}/?error=payment_not_found`);
    }

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

      // Kick off groomer dispatch
      tryNextGroomer(bookingId).catch(console.error);

      return NextResponse.redirect(`${appUrl}/booking/${bookingId}`);
    } else {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      return NextResponse.redirect(`${appUrl}/?error=payment_failed`);
    }
  } catch (err) {
    console.error("payment verify error:", err);
    return NextResponse.redirect(`${appUrl}/?error=payment_error`);
  }
}
