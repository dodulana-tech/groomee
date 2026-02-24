import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

export async function GET() {
  try {
    await requireAdmin();

    // Get all groomers with unpaid earnings
    const groomersWithEarnings = await db.groomer.findMany({
      where: { earnings: { some: { paid: false } } },
      include: {
        earnings: {
          where: { paid: false },
        },
        _count: { select: { earnings: true } },
      },
    });

    const summary = await Promise.all(
      groomersWithEarnings.map(async (g) => {
        const agg = await db.earning.aggregate({
          where: { groomerId: g.id, paid: false },
          _sum: { amount: true },
          _count: { id: true },
        });
        return {
          groomer: {
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

// POST /api/admin/payouts — initiate payouts
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { groomerIds } = await req.json(); // array of groomer IDs to pay

    const now = new Date();
    const periodStart = startOfWeek(subWeeks(now, 1));
    const periodEnd = endOfWeek(subWeeks(now, 1));

    const results = [];

    for (const groomerId of groomerIds) {
      const groomer = await db.groomer.findUnique({ where: { id: groomerId } });
      if (!groomer?.bankAccount || !groomer?.bankName) {
        results.push({
          groomerId,
          success: false,
          reason: "Missing bank details",
        });
        continue;
      }

      const agg = await db.earning.aggregate({
        where: { groomerId, paid: false },
        _sum: { amount: true },
      });

      const amount = agg._sum.amount ?? 0;
      if (amount < 500) {
        results.push({
          groomerId,
          success: false,
          reason: "Amount below minimum (₦500)",
        });
        continue;
      }

      try {
        // Get or create recipient code
        let recipientCode = "";
        recipientCode = await createTransferRecipient({
          accountName: groomer.name,
          accountNumber: groomer.bankAccount,
          bankCode: groomer.bankName, // assumes bankName stores code
        });

        const transferRef = `PAY-${groomerId.slice(-8)}-${Date.now()}`;
        const transfer = (await initiateTransfer({
          amount,
          recipientCode,
          reason: `Groomee payout — week ending ${periodEnd.toDateString()}`,
          reference: transferRef,
        })) as { data: { transfer_code: string } };

        // Create payout record
        const payout = await db.payout.create({
          data: {
            groomerId,
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
          where: { groomerId, paid: false },
          data: { paid: true, payoutId: payout.id },
        });

        results.push({ groomerId, success: true, amount, payoutId: payout.id });
      } catch (err) {
        results.push({ groomerId, success: false, reason: String(err) });
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
