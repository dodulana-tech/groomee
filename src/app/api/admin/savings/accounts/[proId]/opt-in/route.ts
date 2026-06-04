import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { optInPro } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsOptIn } from "@/lib/whatsapp";

// POST /api/admin/savings/accounts/[proId]/opt-in
// Body: { rate?: number; goalLabels?: string[]; note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  let body: { rate?: number; goalLabels?: string[]; note?: string } = {};
  try {
    body = await req.json();
  } catch {}

  try {
    const account = await optInPro(proId, body);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.opt_in",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, rate: account.skimRate, goalLabels: account.goalLabels, note: body.note },
    });

    const pro = await db.pro.findUnique({ where: { id: proId }, select: { phone: true } });
    if (pro?.phone) {
      notifyProSavingsOptIn(pro.phone, account.skimRate).catch((err) =>
        console.error("[savings/opt-in notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[savings/opt-in] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
