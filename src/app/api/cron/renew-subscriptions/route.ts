import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addMonths } from "date-fns";

// GET /api/cron/renew-subscriptions - called by cron job daily
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find subscriptions due for renewal
  const dueSubs = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextBillingDate: { lte: now },
      paystackAuthCode: { not: null },
    },
    include: { plan: true, user: true },
  });

  const results = [];

  for (const sub of dueSubs) {
    try {
      // Charge via Paystack recurring
      const res = await fetch("https://api.paystack.co/transaction/charge_authorization", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorization_code: sub.paystackAuthCode,
          email: sub.user.email ?? `${sub.user.phone.replace(/\+/g, "")}@groomee.ng`,
          amount: Math.round(sub.plan.price * 100), // kobo
          metadata: { type: "subscription_renewal", subscriptionId: sub.id },
        }),
      });

      const data = await res.json();

      if (data.status && data.data?.status === "success") {
        // Renew the subscription
        const newPeriodEnd = addMonths(now, 1);
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodStart: now,
            currentPeriodEnd: newPeriodEnd,
            nextBillingDate: newPeriodEnd,
            creditsRemaining: sub.plan.credits,
          },
        });
        results.push({ subId: sub.id, status: "renewed" });
      } else {
        // Payment failed - mark subscription
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" },
        });
        results.push({ subId: sub.id, status: "payment_failed" });
      }
    } catch (err: any) {
      results.push({ subId: sub.id, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
