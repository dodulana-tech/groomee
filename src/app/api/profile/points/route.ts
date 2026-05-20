import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/profile/points — return balance + last 20 ledger entries
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { points: true },
    });

    const ledger = await db.pointsLedger.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: user?.points ?? 0,
        ledger,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch points." },
      { status: 500 },
    );
  }
}
