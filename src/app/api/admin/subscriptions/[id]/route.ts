import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// PATCH /api/admin/subscriptions/[id]
//
// Body: { action: "cancel" | "credit", credits?: number, reason: string }
//   - cancel: ACTIVE → CANCELLED. reason required.
//   - credit: bump creditsRemaining by `credits`. reason required.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "subscriptions.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { action, credits, reason } = await req.json();

    if (!["cancel", "credit"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 },
      );
    }
    if (typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Please provide a reason (min 5 chars)." },
        { status: 400 },
      );
    }

    const sub = await db.subscription.findUnique({ where: { id } });
    if (!sub) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 });
    }

    let updated;
    if (action === "cancel") {
      if (sub.status === "CANCELLED") {
        return NextResponse.json(
          { success: false, error: "Already cancelled" },
          { status: 400 },
        );
      }
      updated = await db.subscription.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason.trim(),
        },
      });
    } else {
      const delta = Number(credits);
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json(
          { success: false, error: "Provide a non-zero credit amount." },
          { status: 400 },
        );
      }
      updated = await db.subscription.update({
        where: { id },
        data: {
          creditsRemaining: Math.max(0, sub.creditsRemaining + delta),
        },
      });
    }

    await logAdminAction({
      adminId: session!.userId,
      action: `subscription.${action}`,
      entityType: "subscription",
      entityId: id,
      metadata: { reason: reason.trim(), ...(action === "credit" ? { credits } : {}) },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("subscription PATCH error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update subscription" },
      { status: 500 },
    );
  }
}
