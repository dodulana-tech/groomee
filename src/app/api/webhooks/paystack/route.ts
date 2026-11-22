import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "@/lib/paystack";
import { db } from "@/lib/db";
import { postMovement } from "@/lib/wallet";
import { notifyProPayoutReversed } from "@/lib/whatsapp";
import { confirmBookingPayment } from "@/lib/booking-payment";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const body = await req.text();

  if (!validateWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.event) {
      case "charge.success": {
        const ref = event.data.reference;
        const authCode = event.data.authorization?.authorization_code as string | undefined;
        const metadata = event.data.metadata as Record<string, any> | undefined;

        // Booking charges: same path as the checkout callback (payment
        // AUTHORISED → booking DISPATCHING → offer / dispatch → notify). This
        // used to only mark the payment, so a customer who paid without a
        // Groomee session (e.g. from a WhatsApp pay link) left the booking
        // stuck in PENDING_PAYMENT. Idempotent with the callback.
        const isBookingCharge =
          !metadata?.type || metadata.type === "booking";
        if (isBookingCharge && ref) {
          const result = await confirmBookingPayment({
            reference: ref,
            amountKobo: event.data.amount as number,
            bookingIdHint:
              typeof metadata?.bookingId === "string" ? metadata.bookingId : null,
          });
          if (!result.ok && result.reason === "AMOUNT_MISMATCH") {
            console.error(`Webhook amount mismatch for ref ${ref}`);
          }
        }

        // Store auth code on subscription for future auto-renewals
        if (authCode && metadata?.type === "subscription" && metadata?.subscriptionId) {
          await db.subscription.updateMany({
            where: { id: metadata.subscriptionId as string },
            data: { paystackAuthCode: authCode },
          });
        }
        break;
      }

      case "transfer.success": {
        // Idempotent: only update PROCESSING payouts.
        await db.payout.updateMany({
          where: { paystackTransferId: event.data.transfer_code, status: "PROCESSING" },
          data: { status: "COMPLETED", processedAt: new Date() },
        });
        // Savings withdrawals are already optimistically marked PAID inside
        // the release route; success here just confirms. Nothing else to do.
        break;
      }

      case "transfer.failed": {
        // Branch on metadata to route savings_withdrawal failures to the
        // savings unwind instead of the standard PAYOUT_REVERSAL path.
        const meta = event.data.metadata as Record<string, unknown> | undefined;
        const isSavingsWithdrawal =
          meta?.transferType === "savings_withdrawal" && typeof meta?.withdrawalId === "string";
        const reason = (event.data.reason as string) ?? "unknown";

        if (isSavingsWithdrawal) {
          const withdrawalId = meta!.withdrawalId as string;
          try {
            // Mark the Payout row failed (so finance views are consistent),
            // then unwind the savings vault. The savings unwind is idempotent.
            await db.payout.updateMany({
              where: { paystackTransferId: event.data.transfer_code, status: "PROCESSING" },
              data: { status: "FAILED", failureReason: reason },
            });
            const { reverseWithdrawalAfterPaystackFailure } = await import("@/lib/savings");
            const reversed = await reverseWithdrawalAfterPaystackFailure(withdrawalId, reason);
            const pro = await db.pro.findUnique({
              where: { id: reversed.proId },
              select: { phone: true },
            });
            if (pro?.phone) {
              const { notifyProSavingsClawback } = await import("@/lib/whatsapp");
              // Reuse the clawback notification copy — it explains a Reserve
              // amount returning to wallet, which is exactly what happened.
              notifyProSavingsClawback(pro.phone, reversed.netAmount, `Reserve withdrawal ${withdrawalId.slice(-8)}`).catch(
                (err) => console.error("[paystack webhook] savings unwind notify failed", err),
              );
            }
          } catch (err) {
            console.error("[paystack webhook] savings withdrawal unwind failed", err);
          }
          break;
        }

        // Standard payout path: mark FAILED + post PAYOUT_REVERSAL.
        const payout = await db.payout.findFirst({
          where: { paystackTransferId: event.data.transfer_code, status: "PROCESSING" },
          include: { pro: { select: { id: true, phone: true } } },
        });
        if (payout) {
          await db.payout.update({
            where: { id: payout.id },
            data: { status: "FAILED", failureReason: reason },
          });
          try {
            await postMovement({
              proId: payout.proId,
              type: "PAYOUT_REVERSAL",
              amount: Math.abs(payout.amount),
              payoutId: payout.id,
              note: `Paystack transfer ${event.data.transfer_code} failed: ${reason}`,
              idempotencyKey: `payout:${payout.id}:REVERSAL`,
            });
            if (payout.pro?.phone) {
              notifyProPayoutReversed(payout.pro.phone, payout.amount).catch((err) => {
                console.error("[paystack webhook] reversal notify failed", err);
              });
            }
          } catch (walletErr) {
            console.error("[paystack webhook] PAYOUT_REVERSAL post failed", walletErr);
          }
        }
        break;
      }

      case "refund.processed": {
        // Idempotent: only update non-terminal payment statuses
        await db.payment.updateMany({
          where: { paystackRef: event.data.transaction_reference, status: { not: "REFUNDED" } },
          data: { status: "REFUNDED", refundedAt: new Date() },
        });
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
