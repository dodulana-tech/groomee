import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseWithdrawal, markWithdrawalFailed } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsWithdrawalPaid } from "@/lib/whatsapp";
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack";

// POST /api/admin/savings/withdrawals/[id]/release
//
// Triggers the Paystack transfer for the withdrawal's netAmount, then marks
// the withdrawal as PAID and records the WITHDRAWAL_RELEASED + MATCH_BONUS
// movements. If the Paystack transfer fails, marks FAILED and unreserves.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await db.savingsWithdrawal.findUnique({
    where: { id },
    include: { pro: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });
  }
  if (existing.status === "PAID") {
    return NextResponse.json({ success: true, data: existing });
  }
  // SECURITY: only ELIGIBLE — or PENDING whose notice has elapsed — may proceed
  // to a Paystack transfer. CANCELLED / FAILED have already restored balance to
  // the pro's available bucket; releasing them would double-pay. Premature
  // PENDING release would be re-paid by the cron once notice elapses.
  const noticeElapsed =
    existing.status === "PENDING" &&
    existing.noticeUntil instanceof Date &&
    existing.noticeUntil.getTime() <= Date.now();
  if (existing.status !== "ELIGIBLE" && !noticeElapsed) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot release a withdrawal in status ${existing.status}${
          existing.status === "PENDING" ? " (notice period not yet elapsed)" : ""
        }`,
      },
      { status: 409 },
    );
  }
  if (!existing.pro.bankAccount || !existing.pro.bankName) {
    return NextResponse.json(
      { success: false, error: "Pro missing bank details — set them on the pro profile first." },
      { status: 400 },
    );
  }

  // 1. Create or reuse Paystack transfer recipient and initiate transfer for
  //    the net amount. Network call OUTSIDE the savings transaction so a slow
  //    Paystack response doesn't hold a wallet row lock.
  let payoutId: string | null = null;
  let transferOk = true;
  let transferError = "";
  try {
    const recipientCode = await createTransferRecipient({
      accountName: existing.pro.name,
      accountNumber: existing.pro.bankAccount,
      bankCode: existing.pro.bankName,
    });
    const transferRef = `RES-${id.slice(-8)}-${Date.now()}`;
    const transfer = (await initiateTransfer({
      amount: existing.netAmount,
      recipientCode,
      reason: `Groomee Earnings Reserve withdrawal ${id.slice(-8)}`,
      reference: transferRef,
      metadata: { transferType: "savings_withdrawal", withdrawalId: id },
    })) as { data: { transfer_code: string } };

    const payout = await db.payout.create({
      data: {
        proId: existing.proId,
        amount: existing.netAmount,
        status: "PROCESSING",
        paystackTransferId: transfer.data.transfer_code,
        recipientCode,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    payoutId = payout.id;
  } catch (err) {
    transferOk = false;
    transferError = err instanceof Error ? err.message : "Paystack transfer failed";
    console.error("[savings/release] Paystack failure", err);
  }

  if (!transferOk) {
    await markWithdrawalFailed(id, transferError).catch((err) =>
      console.error("[savings/release] markFailed", err),
    );
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.withdrawal_release_failed",
      entityType: "savings_withdrawal",
      entityId: id,
      metadata: { error: transferError },
    });
    return NextResponse.json({ success: false, error: transferError }, { status: 502 });
  }

  try {
    const { withdrawal, matchBonus } = await releaseWithdrawal(id, { payoutId });
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.withdrawal_release",
      entityType: "savings_withdrawal",
      entityId: id,
      metadata: {
        proId: withdrawal.proId,
        amount: withdrawal.amount,
        netAmount: withdrawal.netAmount,
        matchBonus,
        payoutId,
      },
    });
    if (existing.pro.phone) {
      notifyProSavingsWithdrawalPaid(existing.pro.phone, withdrawal.netAmount, matchBonus).catch(
        (err) => console.error("[savings/release notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: { withdrawal, matchBonus } });
  } catch (err) {
    console.error("[savings/release] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
