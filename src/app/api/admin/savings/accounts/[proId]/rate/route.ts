import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSkimRate } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsRateChange } from "@/lib/whatsapp";

// PUT /api/admin/savings/accounts/[proId]/rate
// Body: { rate: number }
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
  const rate = typeof body.rate === "number" ? body.rate : Number(body.rate);
  if (!Number.isFinite(rate)) {
    return NextResponse.json({ success: false, error: "Invalid rate" }, { status: 400 });
  }

  try {
    const { account, oldRate } = await setSkimRate(proId, rate);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.set_rate",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, oldRate, newRate: rate },
    });
    if (oldRate !== rate) {
      const pro = await db.pro.findUnique({ where: { id: proId }, select: { phone: true } });
      if (pro?.phone) {
        notifyProSavingsRateChange(pro.phone, oldRate, rate).catch((err) =>
          console.error("[savings/rate notify]", err),
        );
      }
    }
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[savings/rate] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
