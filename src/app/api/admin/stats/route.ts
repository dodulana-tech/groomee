import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "dashboard.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 6);

    const [
      todayRevenue,
      activeBookings,
      prosOnline,
      openDisputes,
      weeklyData,
      recentBookings,
      proAvailability,
    ] = await Promise.all([
      // Today's captured revenue
      db.payment.aggregate({
        where: { status: "CAPTURED", capturedAt: { gte: today } },
        _sum: { amount: true },
      }),
      // Active bookings
      db.booking.count({
        where: {
          status: {
            in: [
              "DISPATCHING",
              "ACCEPTED",
              "EN_ROUTE",
              "ARRIVED",
              "IN_SERVICE",
              "COMPLETED",
            ],
          },
        },
      }),
      // Pros online
      db.pro.count({ where: { availability: "ONLINE", status: "ACTIVE" } }),
      // Open disputes
      db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      // Weekly booking counts
      db.booking.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      // Recent bookings
      db.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          pro: true,
          service: true,
          zone: true,
          payment: true,
          dispute: true,
          review: true,
        },
      }),
      // Pro availability
      db.pro.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ availability: "asc" }, { avgRating: "desc" }],
        take: 20,
      }),
    ]);

    // Aggregate weekly by day
    const dayMap: Record<string, { count: number; revenue: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { count: 0, revenue: 0 };
    }
    for (const row of weeklyData) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].count += row._count.id;
        dayMap[key].revenue += row._sum.totalAmount ?? 0;
      }
    }
    const weeklyBookings = Object.entries(dayMap).map(([day, data]) => ({
      day,
      ...data,
    }));

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue: todayRevenue._sum.amount ?? 0,
        activeBookings,
        prosOnline,
        openDisputes,
        weeklyBookings,
        recentBookings,
        proAvailability: proAvailability.map((g) => ({
          pro: g,
          availability: g.availability,
          currentJob: g.currentBookingId,
        })),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
