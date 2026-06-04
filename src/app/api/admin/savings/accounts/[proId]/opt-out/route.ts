import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { optOutPro } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsOptOut } from "@/lib/whatsapp";

// POST /api/admin/savings/accounts/[proId]/opt-out
// Body: { note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  let body: { note?: string } = {};
  try {
    body = await req.json();
  } catch {}

  try {
    const account = await optOutPro(proId, body);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.opt_out",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, note: body.note },
    });

    const pro = await db.pro.findUnique({ where: { id: proId }, select: { phone: true } });
    if (pro?.phone) {
      notifyProSavingsOptOut(pro.phone).catch((err) =>
        console.error("[savings/opt-out notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[savings/opt-out] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
