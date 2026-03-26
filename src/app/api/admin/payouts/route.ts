import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

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
      prosWithEarnings.map(async (g) => {
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

        const transferRef = `PAY-${proId.slice(-8)}-${Date.now()}`;
        const transfer = (await initiateTransfer({
          amount,
          recipientCode,
          reason: `Groomee payout - week ending ${periodEnd.toDateString()}`,
          reference: transferRef,
        })) as { data: { transfer_code: string } };

        // Create payout record
        const payout = await db.payout.create({
          data: {
            proId,
            amount,
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

        results.push({ proId, success: true, amount, payoutId: payout.id });
      } catch (err) {
        console.error(`Payout failed for pro ${proId}:`, err);
        results.push({ proId, success: false, reason: "Payout processing failed" });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
