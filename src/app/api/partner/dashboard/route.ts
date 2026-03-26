import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Find the pro record linked to this user's phone
    const pro = await db.pro.findFirst({
      where: { phone: session.phone },
    });

    if (!pro) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayBookings, weeklyEarnings, monthlyEarnings, pendingBalance, activeBooking] =
      await Promise.all([
        db.booking.count({
          where: { proId: pro.id, createdAt: { gte: today } },
        }),
        db.earning.aggregate({
          where: { proId: pro.id, createdAt: { gte: weekAgo } },
          _sum: { amount: true },
        }),
        db.earning.aggregate({
          where: { proId: pro.id, createdAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
        db.earning.aggregate({
          where: { proId: pro.id, paid: false },
          _sum: { amount: true },
        }),
        db.booking.findFirst({
          where: {
            proId: pro.id,
            status: { in: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE"] },
          },
          include: { service: true, zone: true },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        todayBookings,
        weeklyEarnings: weeklyEarnings._sum.amount ?? 0,
        monthlyEarnings: monthlyEarnings._sum.amount ?? 0,
        pendingBalance: pendingBalance._sum.amount ?? 0,
        avgRating: pro.avgRating,
        reviewCount: pro.reviewCount,
        totalJobs: pro.totalJobs,
        acceptanceRate: pro.acceptanceRate,
        tier:
          pro.totalJobs >= 200 && pro.avgRating >= 4.7 && pro.acceptanceRate >= 0.9
            ? "ELITE"
            : pro.totalJobs >= 50 && pro.avgRating >= 4.5 && pro.acceptanceRate >= 0.8
              ? "PRO"
              : "STANDARD",
        tierProgress: Math.min(1, pro.totalJobs / 50), // Progress to Pro tier
        isOnline: pro.availability === "ONLINE",
        activeBooking: activeBooking
          ? {
              id: activeBooking.id,
              status: activeBooking.status,
              service: activeBooking.service.name,
              customerArea: activeBooking.zone?.name ?? "Lagos",
            }
          : null,
        upcomingBookings: [],
      },
    });
  } catch (err) {
    console.error("partner dashboard error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard" },
      { status: 500 },
    );
  }
}
