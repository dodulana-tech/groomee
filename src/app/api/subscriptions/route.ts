import { NextRequest, NextResponse } from "next/server";
import { getSession, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initializeTransaction,
  generatePaymentReference,
} from "@/lib/paystack";
import { addMonths, startOfDay } from "date-fns";

// GET /api/subscriptions — get plans + current subscription
export async function GET() {
  const session = await getSession();

  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  let currentSubscription = null;
  if (session) {
    currentSubscription = await db.subscription.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: {
        plan: true,
        usages: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: { plans, currentSubscription },
  });
}

// POST /api/subscriptions — subscribe to a plan
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json(
        { success: false, error: "planId required." },
        { status: 400 },
      );
    }

    // Check no active subscription
    const existing = await db.subscription.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an active subscription. Cancel it first.",
        },
        { status: 400 },
      );
    }

    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId, isActive: true },
    });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Plan not found." },
        { status: 404 },
      );
    }

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user)
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );

    const now = startOfDay(new Date());
    const periodEnd = addMonths(now, 1);
    const ref = generatePaymentReference(`SUB-${planId.slice(-6)}`);

    // Create pending subscription
    const subscription = await db.subscription.create({
      data: {
        userId: session.userId,
        planId,
        status: "ACTIVE", // will be validated after payment
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        creditsRemaining: plan.credits,
        creditsTotal: plan.credits,
      },
    });

    // Initialize payment
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paystack = await initializeTransaction({
      email: user.email ?? `${user.phone.replace(/\+/g, "")}@groomee.ng`,
      phone: user.phone,
      amount: plan.price,
      reference: ref,
      callbackUrl: `${appUrl}/api/subscriptions/${subscription.id}/activate?ref=${ref}`,
      metadata: {
        type: "subscription",
        subscriptionId: subscription.id,
        planId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          subscriptionId: subscription.id,
          authorizationUrl: paystack.authorization_url,
          plan,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("subscribe error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to subscribe." },
      { status: 500 },
    );
  }
}
