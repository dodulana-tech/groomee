import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/savings/accounts/[proId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;

  try {
    const account = await db.proSavingsAccount.findUnique({
      where: { proId },
      include: { pro: { select: { id: true, name: true, phone: true } } },
    });
    if (!account) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }
    const [movements, totalMovements, withdrawals] = await Promise.all([
      db.savingsMovement.findMany({
        where: { proId },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.savingsMovement.count({ where: { proId } }),
      db.savingsWithdrawal.findMany({
        where: { proId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json({
      success: true,
      data: { account, movements, totalMovements, withdrawals, page, pageSize },
    });
  } catch (err) {
    console.error("[savings/accounts/[proId]] error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
