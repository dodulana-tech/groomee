import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSavingsAccount, loadSavingsSettings } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

// GET /api/partner/reserve/summary
// Returns the Reserve snapshot the partner UI needs to render the page:
// opt-in state, balances, totals, goals + the platform configuration the pro
// is allowed to use to make decisions (slider bounds, notice, penalty, match).
export async function GET() {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  try {
    // Make sure the account row exists so first-time visitors get a stable
    // shape back. ensureSavingsAccount defaults optedIn=false so this is a
    // safe pre-touch.
    const account = await ensureSavingsAccount(proId);
    const settings = await loadSavingsSettings();
    const goals = Array.isArray(account.goalLabels)
      ? account.goalLabels.map((name, idx) => ({ name, sortOrder: idx }))
      : [];
    // Total live balance = available + locked + pending withdrawal. The UI
    // surfaces these as separate buckets but a single "Reserve total" rolls
    // them up.
    const totalBalance =
      account.balanceAvailable +
      account.balanceLocked +
      account.balancePendingWd;

    // Surface a single open withdrawal count for badge UI on the dashboard
    // nudge / sidebar without an extra fetch.
    const openWithdrawals = await db.savingsWithdrawal.count({
      where: { proId, status: { in: ["PENDING", "ELIGIBLE"] } },
    });

    return NextResponse.json({
      success: true,
      data: {
        optedIn: account.optedIn,
        optedInAt: account.optedInAt,
        optedOutAt: account.optedOutAt,
        rate: account.skimRate,
        noticeDays: account.noticeDays,
        instantPenaltyPct: account.penaltyPct,
        balanceAvailable: account.balanceAvailable,
        balanceLocked: account.balanceLocked,
        balancePendingWd: account.balancePendingWd,
        totalBalance,
        totalSkimmed: account.totalSkimmed,
        totalMatchEarned: account.totalMatchEarned,
        totalWithdrawn: account.totalWithdrawn,
        goals,
        openWithdrawals,
        config: {
          enabled: settings.enabled,
          defaultRate: settings.rate,
          minRate: settings.sliderMin,
          maxRate: settings.sliderMax,
          noticeDays: settings.noticeDays,
          instantPenaltyPct: settings.penaltyPct,
          matchBonusPct: settings.matchBonusPct,
        },
      },
    });
  } catch (err) {
    console.error("[partner/reserve/summary]", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
