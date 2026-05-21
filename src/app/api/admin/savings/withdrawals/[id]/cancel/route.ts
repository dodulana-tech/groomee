import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { cancelWithdrawal } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/savings/withdrawals/[id]/cancel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await cancelWithdrawal(id, {
      adminId: session!.userId,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.withdrawal_cancel",
      entityType: "savings_withdrawal",
      entityId: id,
      metadata: { note: body.note, status: result.status },
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[savings/withdrawal cancel] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
