import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { recalcCachedBalances } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/savings/accounts/[proId]/verify-balances
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  try {
    const result = await recalcCachedBalances(proId);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.verify_balances",
      entityType: "savings_account",
      entityId: proId,
      metadata: result,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[savings/verify-balances] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
