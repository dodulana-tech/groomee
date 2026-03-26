import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import { awardPoints } from "@/lib/points";

const SUBSCRIPTION_ACTIVATION_POINTS = 5;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!ref || !id) {
    return NextResponse.redirect(
      `${appUrl}/subscriptions?error=payment_failed`,
    );
  }

  try {
    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.redirect(
        `${appUrl}/subscriptions?error=payment_failed`,
      );
    }

    // Idempotency — don't reprocess an already-active subscription
    if (subscription.status === "ACTIVE") {
      return NextResponse.redirect(
        `${appUrl}/subscriptions?success=already_active`,
      );
    }

    const txData = await verifyTransaction(ref);

    if (txData.status === "success") {
      await db.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          creditsRemaining: subscription.plan.credits,
          paystackAuthCode: txData.authorization?.authorization_code ?? null,
        },
      });

      // Award 5 Groomee Points for subscribing
      await awardPoints(
        subscription.userId,
        SUBSCRIPTION_ACTIVATION_POINTS,
        "Subscription activated",
        id,
      ).catch(console.error);

      return NextResponse.redirect(
        `${appUrl}/subscriptions?success=subscribed`,
      );
    } else {
      // Payment failed or abandoned — clean up the pending subscription
      await db.subscription.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Payment failed" },
      });

      return NextResponse.redirect(
        `${appUrl}/subscriptions?error=payment_failed`,
      );
    }
  } catch (err) {
    console.error("[subscription activate] error:", err);
    return NextResponse.redirect(
      `${appUrl}/subscriptions?error=payment_failed`,
    );
  }
}
