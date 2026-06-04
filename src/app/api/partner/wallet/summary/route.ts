import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureWallet, loadReleaseFractions } from "@/lib/wallet";

// GET /api/partner/wallet/summary
//
// Returns the pro's wallet KPIs:
//   { available, pending, netAdvanceOwed, creditLimit, fractions, lastMovementAt }
//
// `pending` is derived: sum of proEarning for in-flight bookings (ACCEPTED ..
// COMPLETED, not yet CONFIRMED) minus the wallet movements already posted
// against those bookings. This is the "money still on its way to you" number.
//
// Strict scoping: proId is always resolved from session.userId — clients never
// pass it. Anonymous and non-PRO requests are rejected.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 403 });
    }

    // Lazy-init wallet so first-time visits don't 404.
    const wallet = await ensureWallet(pro.id);
    const fractions = await loadReleaseFractions();

    // Compute in-flight pending: bookings assigned to this pro that haven't
    // settled yet, minus money already moved to the wallet for them.
    const inFlight = await db.booking.findMany({
      where: {
        proId: pro.id,
        status: {
          in: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE", "COMPLETED"],
        },
      },
      select: { id: true, proEarning: true },
    });

    let pending = 0;
    if (inFlight.length > 0) {
      const ids = inFlight.map((b) => b.id);
      const released = await db.walletLedger.groupBy({
        by: ["bookingId"],
        where: {
          proId: pro.id,
          bookingId: { in: ids },
          type: {
            in: [
              "MOBILIZATION",
              "COMPLETION_RELEASE",
              "CONFIRM_RELEASE",
              "CLAWBACK",
            ],
          },
        },
        _sum: { amount: true },
      });
      const releasedByBooking = new Map<string, number>(
        released.map((r) => [r.bookingId ?? "", r._sum.amount ?? 0]),
      );
      for (const b of inFlight) {
        const earned = b.proEarning ?? 0;
        const out = releasedByBooking.get(b.id) ?? 0;
        const stillOwed = Math.max(0, earned - out);
        pending += stillOwed;
      }
      pending = Math.round(pending * 100) / 100;
    }

    const lastMovement = await db.walletLedger.findFirst({
      where: { proId: pro.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        available: wallet.available,
        pending,
        netAdvanceOwed: wallet.netAdvanceOwed,
        creditLimit: wallet.creditLimit,
        fractions,
        lastMovementAt: lastMovement?.createdAt ?? null,
      },
    });
  } catch (err) {
    console.error("partner wallet summary error:", err);
    return NextResponse.json(
      { success: false, error: "Failed" },
      { status: 500 },
    );
  }
}
