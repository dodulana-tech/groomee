import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureWallet, loadAdvanceRepayRate } from "@/lib/wallet";

// GET /api/partner/wallet/advances
//
// Returns the pro's advance history + eligibility snapshot used by the
// /partner/wallet/advances page.
//
// Eligibility settings live in the Settings table (ADVANCE_MAX_AMOUNT,
// ADVANCE_MIN_JOBS, ADVANCE_MIN_RATING). We re-read them here so the UI
// doesn't have to duplicate the rules baked into POST /api/pro/advance.
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

    const [settings, advances, wallet, repayRate] = await Promise.all([
      db.setting.findMany({
        where: {
          key: {
            in: ["ADVANCE_MAX_AMOUNT", "ADVANCE_MIN_JOBS", "ADVANCE_MIN_RATING"],
          },
        },
      }),
      db.proAdvance.findMany({
        where: { proId: pro.id },
        orderBy: { createdAt: "desc" },
      }),
      ensureWallet(pro.id),
      loadAdvanceRepayRate(),
    ]);
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const maxAmount = parseFloat(map.ADVANCE_MAX_AMOUNT ?? "30000");
    const minJobs = parseInt(map.ADVANCE_MIN_JOBS ?? "10", 10);
    const minRating = parseFloat(map.ADVANCE_MIN_RATING ?? "4.0");

    const hasOpen = advances.some((a) =>
      ["PENDING", "APPROVED", "DISBURSED"].includes(a.status),
    );
    const meetsJobs = pro.totalJobs >= minJobs;
    const meetsRating = pro.avgRating >= minRating;
    const eligible = meetsJobs && meetsRating && !hasOpen;

    return NextResponse.json({
      success: true,
      data: {
        advances,
        eligibility: {
          eligible,
          hasOpen,
          meetsJobs,
          meetsRating,
          minJobs,
          minRating,
          maxAmount,
          totalJobs: pro.totalJobs,
          avgRating: pro.avgRating,
        },
        netAdvanceOwed: wallet.netAdvanceOwed,
        repayRate,
      },
    });
  } catch (err) {
    console.error("partner wallet advances error:", err);
    return NextResponse.json(
      { success: false, error: "Failed" },
      { status: 500 },
    );
  }
}
