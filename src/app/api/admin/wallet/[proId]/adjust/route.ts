import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { postMovement } from "@/lib/wallet";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProManualAdjustment } from "@/lib/whatsapp";

// POST /api/admin/wallet/[proId]/adjust
//
// Body: { amount: number, note: string }
//   - amount is signed (+credit, -debit)
//   - note is required and surfaced on the ledger row + WhatsApp message
//
// Gated by wallet.manage. Idempotency key: admin-adjust:{ts}:{adminId}.
// Always audit-logged.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "wallet.manage")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { proId } = await params;
  let body: { amount?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json(
      { success: false, error: "Amount must be a non-zero number" },
      { status: 400 },
    );
  }
  if (Math.abs(amount) > 1_000_000) {
    return NextResponse.json(
      { success: false, error: "Adjustments above ₦1,000,000 are blocked. Split into smaller entries." },
      { status: 400 },
    );
  }
  if (!note) {
    return NextResponse.json(
      { success: false, error: "A note is required for manual adjustments." },
      { status: 400 },
    );
  }

  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true, phone: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "Pro not found" },
      { status: 404 },
    );
  }

  try {
    const result = await postMovement({
      proId,
      type: "MANUAL_ADJUSTMENT",
      amount,
      note,
      idempotencyKey: `admin-adjust:${Date.now()}:${session!.userId}`,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "wallet.adjust",
      entityType: "wallet",
      entityId: proId,
      metadata: {
        proName: pro.name,
        amount,
        note,
        ledgerId: result.ledger.id,
        balanceAfter: result.wallet.available,
      },
    });

    // Fire-and-forget WhatsApp notify.
    if (pro.phone) {
      notifyProManualAdjustment(pro.phone, amount, note).catch((err) => {
        console.error("[wallet.adjust] notify failed", err);
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("wallet adjust error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to post adjustment" },
      { status: 500 },
    );
  }
}
