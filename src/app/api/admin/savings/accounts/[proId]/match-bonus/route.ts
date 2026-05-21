import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyMatchBonus } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsMatchBonus } from "@/lib/whatsapp";

// POST /api/admin/savings/accounts/[proId]/match-bonus
// Body: { amount: number (positive NGN); note: string (min 5 chars) }
//
// Admin-awarded loyalty top-up. Credits the pro's available balance, posts a
// MATCH_BONUS movement, and bumps totalMatchEarned. Fires a WhatsApp to the
// pro post-commit (best effort).
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

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "Amount must be a positive number" },
      { status: 400 },
    );
  }
  if (note.trim().length < 5) {
    return NextResponse.json(
      { success: false, error: "Note required (min 5 chars)" },
      { status: 400 },
    );
  }

  try {
    const { movement, account } = await applyMatchBonus(proId, amount, note);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.match_bonus",
      entityType: "savings_account",
      entityId: account.id,
      metadata: { proId, amount, note },
    });
    const pro = await db.pro.findUnique({
      where: { id: proId },
      select: { phone: true },
    });
    if (pro?.phone) {
      notifyProSavingsMatchBonus(pro.phone, amount, note.trim()).catch((err) =>
        console.error("[savings/match-bonus notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: { movement, account } });
  } catch (err) {
    console.error("[savings/match-bonus] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
