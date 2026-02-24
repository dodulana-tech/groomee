import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "@/lib/paystack";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const body = await req.text();

  if (!validateWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);

  try {
    switch (event.event) {
      case "charge.success": {
        const ref = event.data.reference;
        const payment = await db.payment.findFirst({
          where: { paystackRef: ref },
        });
        if (payment && payment.status === "PENDING") {
          await db.payment.update({
            where: { id: payment.id },
            data: { status: "AUTHORISED", authorisedAt: new Date() },
          });
        }
        break;
      }

      case "transfer.success": {
        const payout = await db.payout.findFirst({
          where: { paystackTransferId: event.data.transfer_code },
        });
        if (payout) {
          await db.payout.update({
            where: { id: payout.id },
            data: { status: "COMPLETED", processedAt: new Date() },
          });
        }
        break;
      }

      case "transfer.failed": {
        const payout = await db.payout.findFirst({
          where: { paystackTransferId: event.data.transfer_code },
        });
        if (payout) {
          await db.payout.update({
            where: { id: payout.id },
            data: { status: "FAILED", failureReason: event.data.reason },
          });
        }
        break;
      }

      case "refund.processed": {
        const payment = await db.payment.findFirst({
          where: { paystackRef: event.data.transaction_reference },
        });
        if (payment) {
          await db.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED", refundedAt: new Date() },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Paystack webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
