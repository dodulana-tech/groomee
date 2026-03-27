import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({ where: { phone: session.phone } });
    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    const [totalEarned, pendingBalance, totalPaidOut, recentEarnings] =
      await Promise.all([
        db.earning.aggregate({
          where: { proId: pro.id },
          _sum: { amount: true },
        }),
        db.earning.aggregate({
          where: { proId: pro.id, paid: false },
          _sum: { amount: true },
        }),
        db.earning.aggregate({
          where: { proId: pro.id, paid: true },
          _sum: { amount: true },
        }),
        db.earning.findMany({
          where: { proId: pro.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

    // Fetch service names for recent earnings via bookings
    const earningsWithService = await Promise.all(
      recentEarnings.map(async (e) => {
        const booking = await db.booking.findUnique({
          where: { id: e.bookingId },
          select: { service: { select: { name: true } } },
        });
        return {
          id: e.id,
          amount: e.amount,
          paid: e.paid,
          createdAt: e.createdAt,
          serviceName: (booking as any)?.service?.name ?? "Service",
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        totalEarned: totalEarned._sum.amount ?? 0,
        pendingBalance: pendingBalance._sum.amount ?? 0,
        totalPaidOut: totalPaidOut._sum.amount ?? 0,
        nextPayoutDate: "Friday",
        bankName: pro.bankName,
        bankAccountLast4: pro.bankAccountNo?.slice(-4) ?? pro.bankAccount?.slice(-4),
        recentEarnings: earningsWithService,
      },
    });
  } catch (err) {
    console.error("partner earnings error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
