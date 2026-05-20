import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/payouts/[id]/retry
//
// Re-attempts a payout that previously failed. Only allowed for FAILED
// payouts; PROCESSING / SUCCESS get a 400. Bank details on the pro must be
// filled in (we re-create the recipient code in case bank changed).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "payouts.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const payout = await db.payout.findUnique({
      where: { id },
      include: { pro: true },
    });
    if (!payout) {
      return NextResponse.json({ success: false, error: "Payout not found" }, { status: 404 });
    }
    if (payout.status === "SUCCESS") {
      return NextResponse.json(
        { success: false, error: "This payout has already succeeded." },
        { status: 400 },
      );
    }
    if (payout.status === "PROCESSING") {
      return NextResponse.json(
        {
          success: false,
          error: "Payout is still processing — wait for the Paystack callback before retrying.",
        },
        { status: 400 },
      );
    }
    if (!payout.pro.bankAccount || !payout.pro.bankName) {
      return NextResponse.json(
        { success: false, error: "Pro bank details are missing — ask them to update before retrying." },
        { status: 400 },
      );
    }

    try {
      const recipientCode = await createTransferRecipient({
        accountName: payout.pro.name,
        accountNumber: payout.pro.bankAccount,
        bankCode: payout.pro.bankName,
      });

      const transferRef = `PAY-${payout.proId.slice(-8)}-${Date.now()}`;
      const transfer = (await initiateTransfer({
        amount: payout.amount,
        recipientCode,
        reason: `Groomee payout retry — ${payout.id}`,
        reference: transferRef,
      })) as { data: { transfer_code: string } };

      const updated = await db.payout.update({
        where: { id },
        data: {
          status: "PROCESSING",
          paystackTransferId: transfer.data.transfer_code,
          recipientCode,
          failureReason: null,
        },
      });

      await logAdminAction({
        adminId: session!.userId,
        action: "payout.retry",
        entityType: "payout",
        entityId: id,
        metadata: { proId: payout.proId, amount: payout.amount, transferRef },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Paystack call failed";
      await db.payout.update({
        where: { id },
        data: { status: "FAILED", failureReason: reason },
      });
      console.error("payout retry failed", err);
      return NextResponse.json(
        { success: false, error: `Retry failed: ${reason}` },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("payout retry error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to retry payout" },
      { status: 500 },
    );
  }
}
