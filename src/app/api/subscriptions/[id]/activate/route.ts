import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
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
    return NextResponse.redirect(`${appUrl}/subscriptions?error=payment_failed`);
  }

  try {
    // Auth: verify caller owns the subscription
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(`${appUrl}/auth?redirect=/subscriptions`);
    }

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription || subscription.userId !== session.userId) {
      return NextResponse.redirect(`${appUrl}/subscriptions?error=payment_failed`);
    }

    if (subscription.status === "ACTIVE") {
      return NextResponse.redirect(`${appUrl}/subscriptions?success=already_active`);
    }

    const txData = await verifyTransaction(ref);

    if (txData.status === "success") {
      // Atomic: only activate if still PENDING
      const updated = await db.subscription.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "ACTIVE",
          creditsRemaining: subscription.plan.credits,
          paystackAuthCode: txData.authorization?.authorization_code ?? null,
        },
      });

      if (updated.count > 0) {
        await awardPoints(
          subscription.userId,
          SUBSCRIPTION_ACTIVATION_POINTS,
          "Subscription activated",
          id,
        ).catch(console.error);
      }

      return NextResponse.redirect(`${appUrl}/subscriptions?success=subscribed`);
    } else {
      await db.subscription.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Payment failed" },
      });

      return NextResponse.redirect(`${appUrl}/subscriptions?error=payment_failed`);
    }
  } catch (err) {
    console.error("[subscription activate] error:", err);
    return NextResponse.redirect(`${appUrl}/subscriptions?error=payment_failed`);
  }
}
