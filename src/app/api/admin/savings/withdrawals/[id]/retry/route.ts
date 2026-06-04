import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseWithdrawal, markWithdrawalFailed } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyProSavingsWithdrawalPaid } from "@/lib/whatsapp";
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack";

// POST /api/admin/savings/withdrawals/[id]/retry
//
// Retry a FAILED withdrawal. Re-reserves the balance (available → pendingWd),
// re-initiates the Paystack transfer, and re-runs the release path. If the
// withdrawal is not FAILED, returns 400.
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
  if (existing.status !== "FAILED") {
    return NextResponse.json(
      { success: false, error: `Cannot retry from status ${existing.status}` },
      { status: 400 },
    );
  }
  if (!existing.pro.bankAccount || !existing.pro.bankName) {
    return NextResponse.json(
      { success: false, error: "Pro missing bank details — set them on the pro profile first." },
      { status: 400 },
    );
  }

  // 1. Flip the row back to ELIGIBLE and re-reserve the balance. We use a
  //    fresh release path on top so the helpers stay simple. Idempotency on
  //    the underlying movements keeps double-clicks safe.
  const account = await db.proSavingsAccount.findUnique({ where: { id: existing.accountId } });
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 500 });
  }
  if (account.balanceAvailable < existing.amount) {
    return NextResponse.json(
      { success: false, error: "Insufficient available balance to retry" },
      { status: 400 },
    );
  }
  await db.$transaction(async (tx) => {
    await tx.proSavingsAccount.update({
      where: { id: existing.accountId },
      data: {
        balanceAvailable: { decrement: existing.amount },
        balancePendingWd: { increment: existing.amount },
      },
    });
    await tx.savingsWithdrawal.update({
      where: { id },
      data: { status: "ELIGIBLE", failureReason: null, noticeUntil: new Date() },
    });
  });

  // 2. Re-initiate Paystack transfer with savings_withdrawal metadata.
  let payoutId: string | null = null;
  let transferOk = true;
  let transferError = "";
  try {
    const recipientCode = await createTransferRecipient({
      accountName: existing.pro.name,
      accountNumber: existing.pro.bankAccount!,
      bankCode: existing.pro.bankName!,
    });
    const transferRef = `RES-RETRY-${id.slice(-8)}-${Date.now()}`;
    const transfer = (await initiateTransfer({
      amount: existing.netAmount,
      recipientCode,
      reason: `Groomee Earnings Reserve retry ${id.slice(-8)}`,
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
    console.error("[savings/retry] Paystack failure", err);
  }

  if (!transferOk) {
    await markWithdrawalFailed(id, transferError).catch((err) =>
      console.error("[savings/retry markFailed]", err),
    );
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.withdrawal_retry_failed",
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
      action: "savings.withdrawal_retry",
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
        (err) => console.error("[savings/retry notify]", err),
      );
    }
    return NextResponse.json({ success: true, data: { withdrawal, matchBonus } });
  } catch (err) {
    console.error("[savings/retry] release error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
