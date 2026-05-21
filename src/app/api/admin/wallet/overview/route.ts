import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { loadWalletOverviewKpis, listProWalletSummaries } from "@/lib/wallet";

// GET /api/admin/wallet/overview
//
// Returns aggregated KPIs + a table of every pro with a wallet row. Read-only;
// gated by wallet.view.
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "wallet.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  try {
    const [kpis, pros] = await Promise.all([
      loadWalletOverviewKpis(),
      listProWalletSummaries(),
    ]);
    return NextResponse.json({ success: true, data: { kpis, pros } });
  } catch (err) {
    console.error("wallet overview error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load wallet overview" },
      { status: 500 },
    );
  }
}
