import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { outcome, refundAmount, resolution, applyStrike } = body;

    // ─────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────
    const allowedOutcomes = ["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND"];

    if (!allowedOutcomes.includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    if (!resolution?.trim()) {
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
            groomer: true,
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
    const finalRefund =
      outcome === "FULL_REFUND"
        ? dispute.booking.totalAmount
        : outcome === "PARTIAL_REFUND"
          ? (refundAmount ?? 0)
          : 0;

    // ─────────────────────────────────────────
    // DATABASE TRANSACTION
    // ─────────────────────────────────────────
    await db.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolution,
          notes: resolution,
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
          reason: `Dispute resolved: ${resolution}`,
        });
      } catch (err) {
        console.error("Refund failed:", err);
      }
    }

    // ─────────────────────────────────────────
    // APPLY STRIKE (IF REQUIRED)
    // ─────────────────────────────────────────
    if (applyStrike && dispute.booking.groomerId) {
      await db.groomer.update({
        where: { id: dispute.booking.groomerId },
        data: { strikes: { increment: 1 } },
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
