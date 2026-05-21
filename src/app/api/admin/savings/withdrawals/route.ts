import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma, SavingsWithdrawalStatus } from "@prisma/client";

// GET /api/admin/savings/withdrawals?status=PENDING|ELIGIBLE|PAID|CANCELLED|FAILED
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Prisma.SavingsWithdrawalWhereInput = {};
  if (status && ["PENDING", "ELIGIBLE", "PAID", "CANCELLED", "FAILED"].includes(status)) {
    where.status = status as SavingsWithdrawalStatus;
  }
  try {
    const rows = await db.savingsWithdrawal.findMany({
      where,
      include: { pro: { select: { id: true, name: true, phone: true, bankName: true, bankAccount: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[savings/withdrawals GET] error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
