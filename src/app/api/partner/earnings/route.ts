import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    const [
      totalEarned,
      pendingBalance,
      totalPaidOut,
      recentEarnings,
      serviceTotal,
      apprenticeCommissionTotal,
      contributorAgg,
    ] = await Promise.all([
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
      // Breakdown: own-service earnings.
      db.earning.aggregate({
        where: { proId: pro.id, type: "SERVICE" },
        _sum: { amount: true },
      }),
      // Breakdown: commission earned from apprentices.
      db.earning.aggregate({
        where: { proId: pro.id, type: "APPRENTICE_COMMISSION" },
        _sum: { amount: true },
      }),
      // Per-apprentice contribution rollup (master view).
      db.earning.groupBy({
        by: ["sourceProId"],
        where: {
          proId: pro.id,
          type: "APPRENTICE_COMMISSION",
          sourceProId: { not: null },
        },
        _sum: { amount: true },
        _count: { id: true },
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
          type: e.type,
          serviceName: (booking as any)?.service?.name ?? "Service",
        };
      }),
    );

    // Resolve apprentice names for the contributor rollup.
    const contributorIds = contributorAgg
      .map((c) => c.sourceProId)
      .filter((id): id is string => !!id);
    const contributorPros = contributorIds.length
      ? await db.pro.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(contributorPros.map((p) => [p.id, p.name]));
    const apprenticeContributors = contributorAgg
      .filter((c) => c.sourceProId)
      .map((c) => ({
        apprenticeId: c.sourceProId!,
        name: nameById.get(c.sourceProId!) ?? "Apprentice",
        amount: Math.round((c._sum.amount ?? 0) * 100) / 100,
        jobs: c._count.id,
      }))
      .sort((a, b) => b.amount - a.amount);

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
        breakdown: {
          service: serviceTotal._sum.amount ?? 0,
          apprenticeCommission: apprenticeCommissionTotal._sum.amount ?? 0,
        },
        apprenticeContributors,
      },
    });
  } catch (err) {
    console.error("partner earnings error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
