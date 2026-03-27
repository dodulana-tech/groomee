import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ─────────────────────────────────────────
  // AUTHORIZATION
  // ─────────────────────────────────────────
  const session = await getSession();
  if (!hasPermission(session, "disputes.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { outcome, refundAmount, adminNote, applyStrikeToPro } = body;

    // ─────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────
    const allowedOutcomes = ["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND", "CREDIT_ISSUED"];

    if (!allowedOutcomes.includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    if (!adminNote?.trim()) {
      return NextResponse.json(
        { error: "Resolution notes required" },
        { status: 400 },
      );
    }

    // ─────────────────────────────────────────
    // FETCH DISPUTE + RELATED DATA
    // ─────────────────────────────────────────
    const dispute = await db.dispute.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            payment: true,
            pro: true,
          },
        },
      },
    });

    if (!dispute)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (dispute.status === "RESOLVED")
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });

    // ─────────────────────────────────────────
    // DETERMINE REFUND AMOUNT
    // ─────────────────────────────────────────
    // Validate refund amount
    if (outcome === "PARTIAL_REFUND") {
      if (typeof refundAmount !== "number" || refundAmount <= 0) {
        return NextResponse.json({ error: "Refund amount must be a positive number" }, { status: 400 });
      }
      if (refundAmount > dispute.booking.totalAmount) {
        return NextResponse.json({ error: "Refund amount cannot exceed booking total" }, { status: 400 });
      }
    }

    const finalRefund =
      outcome === "FULL_REFUND"
        ? dispute.booking.totalAmount
        : outcome === "PARTIAL_REFUND"
          ? refundAmount
          : 0;

    // ─────────────────────────────────────────
    // DATABASE TRANSACTION
    // ─────────────────────────────────────────
    await db.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolution: adminNote,
          notes: adminNote,
          refundAmount: finalRefund || null,
          resolvedAt: new Date(),
        },
      });

      await tx.booking.update({
        where: { id: dispute.bookingId },
        data: { status: "CONFIRMED" },
      });
    });

    // ─────────────────────────────────────────
    // PROCESS REFUND (NON-BLOCKING)
    // ─────────────────────────────────────────
    if (finalRefund > 0 && dispute.booking.payment?.paystackRef) {
      try {
        await createRefund({
          transaction: dispute.booking.payment.paystackRef,
          amount: finalRefund,
          reason: `Dispute resolved: ${adminNote}`,
        });
      } catch (err) {
        console.error("Refund failed:", err);
      }
    }

    // ─────────────────────────────────────────
    // APPLY STRIKE (IF REQUIRED)
    // ─────────────────────────────────────────
    if (applyStrikeToPro && dispute.booking.proId) {
      await db.pro.update({
        where: { id: dispute.booking.proId },
        data: { strikeCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("resolve dispute error:", error);
    return NextResponse.json(
      { error: "Failed to resolve dispute" },
      { status: 500 },
    );
  }
}
