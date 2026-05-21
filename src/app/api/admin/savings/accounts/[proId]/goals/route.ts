import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { setGoalLabels } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";

// PUT /api/admin/savings/accounts/[proId]/goals
// Body: { goals: string[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  const body = await req.json().catch(() => ({}));
  const goals = Array.isArray(body.goals) ? body.goals : [];

  try {
    const account = await setGoalLabels(proId, goals);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.set_goals",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, goals: account.goalLabels },
    });
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[savings/goals] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
