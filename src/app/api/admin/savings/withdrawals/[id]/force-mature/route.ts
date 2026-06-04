import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { forceMatureWithdrawal } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsWithdrawalEligible } from "@/lib/whatsapp";

// POST /api/admin/savings/withdrawals/[id]/force-mature
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const w = await forceMatureWithdrawal(id);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.force_mature",
      entityType: "savings_withdrawal",
      entityId: id,
      metadata: { newStatus: w.status, amount: w.amount, netAmount: w.netAmount },
    });
    const pro = await db.pro.findUnique({ where: { id: w.proId }, select: { phone: true } });
    if (pro?.phone) {
      notifyProSavingsWithdrawalEligible(pro.phone, w.netAmount).catch((err) =>
        console.error("[savings/force-mature notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: w });
  } catch (err) {
    console.error("[savings/force-mature] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
