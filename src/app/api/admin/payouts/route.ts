import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { logAdminAction } from "@/lib/admin-audit";
import { postMovement, getWallet, loadAdvanceRepayRate } from "@/lib/wallet";
import {
  notifyProPayoutInitiated,
  notifyProAdvanceRepayment,
} from "@/lib/whatsapp";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "payouts.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Get all pros with unpaid earnings
    const prosWithEarnings = await db.pro.findMany({
      where: { earnings: { some: { paid: false } } },
      include: {
        earnings: {
          where: { paid: false },
        },
        _count: { select: { earnings: true } },
      },
    });

    const summary = await Promise.all(
      prosWithEarnings.map(async (g: (typeof prosWithEarnings)[number]) => {
        const agg = await db.earning.aggregate({
          where: { proId: g.id, paid: false },
          _sum: { amount: true },
          _count: { id: true },
        });
        return {
          pro: {
            id: g.id,
            name: g.name,
            phone: g.phone,
            bankName: g.bankName,
            bankAccount: g.bankAccount,
          },
          pendingAmount: agg._sum.amount ?? 0,
          earningCount: agg._count.id,
          canPay: !!(g.bankAccount && g.bankName),
        };
      }),
    );

    return NextResponse.json({ success: true, data: summary });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

// POST /api/admin/payouts - initiate payouts
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "payouts.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { proIds } = await req.json(); // array of pro IDs to pay

    const now = new Date();
    const periodStart = startOfWeek(subWeeks(now, 1));
    const periodEnd = endOfWeek(subWeeks(now, 1));

    // Pull the configurable advance-repayment rate once per batch.
    const advanceRepayRate = await loadAdvanceRepayRate();

    const results = [];

    for (const proId of proIds) {
      const pro = await db.pro.findUnique({ where: { id: proId } });
      if (!pro?.bankAccount || !pro?.bankName) {
        results.push({
          proId,
          success: false,
          reason: "Missing bank details",
        });
        continue;
      }

      const agg = await db.earning.aggregate({
        where: { proId, paid: false },
        _sum: { amount: true },
      });

      const amount = agg._sum.amount ?? 0;
      if (amount < 500) {
        results.push({
          proId,
          success: false,
          reason: "Amount below minimum (₦500)",
        });
        continue;
      }

      try {
        // Get or create recipient code
        let recipientCode = "";
        recipientCode = await createTransferRecipient({
          accountName: pro.name,
          accountNumber: pro.bankAccount,
          bankCode: pro.bankName, // assumes bankName stores code
        });

        // ─── Advance repayment split ────────────────────────────────────
        // If the pro owes a net advance, redirect up to 30% of this payout
        // to ADVANCE_REPAYMENT before debiting the rest as PAYOUT_DEBIT.
        const wallet = await getWallet(proId);
        const owed = wallet?.netAdvanceOwed ?? 0;
        const repayCap = round2(amount * advanceRepayRate);
        const repayAmount = owed > 0 ? Math.min(owed, repayCap) : 0;
        const payoutNet = round2(amount - repayAmount);

        if (payoutNet < 500) {
          results.push({
            proId,
            success: false,
            reason: `Net after advance repayment (₦${payoutNet}) below minimum.`,
          });
          continue;
        }

        const transferRef = `PAY-${proId.slice(-8)}-${Date.now()}`;
        const transfer = (await initiateTransfer({
          amount: payoutNet,
          recipientCode,
          reason: `Groomee payout - week ending ${periodEnd.toDateString()}`,
          reference: transferRef,
        })) as { data: { transfer_code: string } };

        // Create payout record (amount is the NET amount actually transferred)
        const payout = await db.payout.create({
          data: {
            proId,
            amount: payoutNet,
            status: "PROCESSING",
            paystackTransferId: transfer.data.transfer_code,
            recipientCode,
            periodStart,
            periodEnd,
          },
        });

        // Mark earnings as paid
        await db.earning.updateMany({
          where: { proId, paid: false },
          data: { paid: true, payoutId: payout.id },
        });

        // ─── Wallet ledger postings ─────────────────────────────────────
        // Best-effort — log loud if either fails, since admin needs to repair.
        try {
          if (repayAmount > 0) {
            await postMovement({
              proId,
              type: "ADVANCE_REPAYMENT",
              amount: -repayAmount,
              payoutId: payout.id,
              note: `Advance repayment deducted from payout ${payout.id}`,
              idempotencyKey: `payout:${payout.id}:ADVANCE_REPAYMENT`,
            });
            if (pro.phone) {
              const remainingOwed = Math.max(0, round2(owed - repayAmount));
              notifyProAdvanceRepayment(pro.phone, repayAmount, remainingOwed).catch((err) => {
                console.error("[payout] repayment notify failed", err);
              });
            }
          }
          await postMovement({
            proId,
            type: "PAYOUT_DEBIT",
            amount: -payoutNet,
            payoutId: payout.id,
            note: `Payout transfer ${transferRef}`,
            idempotencyKey: `payout:${payout.id}:DEBIT`,
          });
          if (pro.phone) {
            notifyProPayoutInitiated(pro.phone, payoutNet).catch((err) => {
              console.error("[payout] notify failed", err);
            });
          }
        } catch (walletErr) {
          console.error(`[payout] wallet posting failed for ${payout.id}`, walletErr);
        }

        results.push({
          proId,
          success: true,
          amount: payoutNet,
          payoutId: payout.id,
          ...(repayAmount > 0 ? { repaidFromAdvance: repayAmount } : {}),
        });
      } catch (err) {
        console.error(`Payout failed for pro ${proId}:`, err);
        results.push({ proId, success: false, reason: "Payout processing failed" });
      }
    }

    const successful = results.filter((r) => r.success);
    if (successful.length > 0) {
      await logAdminAction({
        adminId: session!.userId,
        action: "payout.process",
        entityType: "payout_batch",
        entityId: `batch-${Date.now()}`,
        metadata: {
          attemptedCount: results.length,
          successCount: successful.length,
          totalAmount: successful.reduce(
            (sum, r) => sum + (("amount" in r && typeof r.amount === "number") ? r.amount : 0),
            0,
          ),
          proIds: successful.map((r) => r.proId),
        },
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
