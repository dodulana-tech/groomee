import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { adjustBalance } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/savings/accounts/[proId]/adjust
// Body: { amount: number; note: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const note = typeof body.note === "string" ? body.note : "";
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ success: false, error: "Amount must be a non-zero number" }, { status: 400 });
  }
  if (note.trim().length < 5) {
    return NextResponse.json({ success: false, error: "Note required (min 5 chars)" }, { status: 400 });
  }

  try {
    const { movement, account } = await adjustBalance(proId, amount, note);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.adjust",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, amount, note },
    });
    return NextResponse.json({ success: true, data: { movement, account } });
  } catch (err) {
    console.error("[savings/adjust] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
