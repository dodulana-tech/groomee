import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { subDays, startOfDay, startOfMonth, differenceInDays } from "date-fns";

export const revalidate = 0;

function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `\u20A6${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `\u20A6${Math.round(amount / 1_000)}k`;
  return `\u20A6${amount.toLocaleString()}`;
}

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const now = new Date();
  const today = startOfDay(now);
  const defaultFrom = sp.from ? new Date(sp.from) : startOfMonth(now);
  const defaultTo = sp.to ? new Date(sp.to) : now;
  // For the 30-day trend chart we still pin to last 30 days for visual stability,
  // but the KPIs honour the user-chosen range.
  const thirtyDaysAgo = subDays(today, 30);
  const monthStart = defaultFrom;
  const rangeEnd = new Date(defaultTo);
  rangeEnd.setHours(23, 59, 59, 999);
  const rangeDays = Math.max(1, differenceInDays(rangeEnd, defaultFrom) + 1);
  const exportQs = `from=${defaultFrom.toISOString().slice(0, 10)}&to=${defaultTo.toISOString().slice(0, 10)}`;

  const [
    monthlyRevenue,
    monthlyBookings,
    totalCustomers,
    totalPros,
    totalWaitlist,
    totalSurveys,
    topPros,
    recentSurveys,
    waitlistByCity,
    bookingTrend,
    surveyByType,
  ] = await Promise.all([
    // Range revenue
    db.payment.aggregate({
      where: { status: "CAPTURED", capturedAt: { gte: monthStart, lte: rangeEnd } },
      _sum: { amount: true },
    }),
    // Range bookings
    db.booking.count({
      where: { createdAt: { gte: monthStart, lte: rangeEnd } },
    }),
    // Total customers
    db.user.count({ where: { role: "CUSTOMER" } }),
    // Total active pros
    db.pro.count({ where: { status: "ACTIVE" } }),
    // Waitlist count
    db.waitlist.count(),
    // Survey count
    db.surveyResponse.count(),
    // Top 10 pros by rating (leaderboard)
    db.pro.findMany({
      where: { status: "ACTIVE", totalJobs: { gte: 1 } },
      orderBy: [{ avgRating: "desc" }, { totalJobs: "desc" }],
      take: 10,
      select: {
        id: true,
        name: true,
        avgRating: true,
        reviewCount: true,
        totalJobs: true,
        acceptanceRate: true,
        availability: true,
      },
    }),
    // Recent survey submissions
    db.surveyResponse.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, phone: true, createdAt: true },
    }),
    // Waitlist by city
    db.waitlist.groupBy({
      by: ["city"],
      _count: { id: true },
    }),
    // Booking trend — last 30 days (fetch lightweight records, aggregate in JS)
    db.booking.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalAmount: true },
    }),
    // Surveys by type
    db.surveyResponse.groupBy({
      by: ["type"],
      _count: { id: true },
    }),
  ]);

  // Build 30-day trend
  const dayMap: Record<string, { count: number; revenue: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = subDays(today, i);
    dayMap[d.toISOString().slice(0, 10)] = { count: 0, revenue: 0 };
  }
  for (const row of bookingTrend) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    if (dayMap[key]) {
      dayMap[key].count += 1;
      dayMap[key].revenue += row.totalAmount ?? 0;
    }
  }
  const trendData = Object.entries(dayMap).map(([day, data]) => ({
    day,
    ...data,
  }));
  const maxTrend = Math.max(...trendData.map((d) => d.count), 1);

  const waitlistCities = waitlistByCity.map((w) => ({
    city: w.city,
    count: w._count.id,
  }));

  const surveyTypes = surveyByType.map((s) => ({
    type: s.type,
    count: s._count.id,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Platform performance, surveys, waitlist, and pro leaderboard · {rangeDays} day{rangeDays !== 1 ? "s" : ""} selected
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/analytics/export?type=bookings&${exportQs}`}
            className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-xl hover:bg-gray-200"
          >
            ⬇ Bookings CSV
          </a>
          <a
            href={`/api/admin/analytics/export?type=payments&${exportQs}`}
            className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-xl hover:bg-gray-200"
          >
            ⬇ Payments CSV
          </a>
          <a
            href={`/api/admin/analytics/export?type=surveys&${exportQs}`}
            className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-xl hover:bg-gray-200"
          >
            ⬇ Surveys CSV
          </a>
          <a
            href={`/api/admin/analytics/export?type=waitlist&${exportQs}`}
            className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-xl hover:bg-gray-200"
          >
            ⬇ Waitlist CSV
          </a>
        </div>
      </div>

      {/* Date range form */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            From
          </label>
          <input
            type="date"
            name="from"
            defaultValue={defaultFrom.toISOString().slice(0, 10)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            To
          </label>
          <input
            type="date"
            name="to"
            defaultValue={defaultTo.toISOString().slice(0, 10)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
        >
          Apply range
        </button>
        {(sp.from || sp.to) && (
          <Link
            href="/admin/analytics"
            className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Reset to month-to-date
          </Link>
        )}
      </form>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Range Revenue", value: formatNaira(monthlyRevenue._sum.amount ?? 0), icon: "💰" },
          { label: "Range Bookings", value: String(monthlyBookings), icon: "📋" },
          { label: "Total Customers", value: String(totalCustomers), icon: "👥" },
          { label: "Active Pros", value: String(totalPros), icon: "💇" },
          { label: "Waitlist Signups", value: String(totalWaitlist), icon: "📝" },
          { label: "Survey Responses", value: String(totalSurveys), icon: "📊" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card rounded-2xl p-4">
            <span className="text-2xl">{kpi.icon}</span>
            <div className="text-2xl font-black text-gray-900 mt-2">{kpi.value}</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* 30-day booking trend */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-bold text-gray-900 mb-1">Booking Trend</h3>
        <p className="text-xs text-gray-400 mb-4">Last 30 days</p>
        <div className="flex items-end gap-[2px] h-32">
          {trendData.map((d) => {
            const h = Math.max(2, Math.round((d.count / maxTrend) * 120));
            return (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} bookings, ${formatNaira(d.revenue)}`}
                className="flex-1 bg-green-400 rounded-t-sm hover:bg-green-500 transition-colors cursor-default"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-400">
          <span>{trendData[0]?.day.slice(5)}</span>
          <span>{trendData[trendData.length - 1]?.day.slice(5)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pro Leaderboard */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold text-gray-900 mb-4">Pro Leaderboard</h3>
          <div className="space-y-3">
            {topPros.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No active pros with completed jobs yet
              </p>
            )}
            {topPros.map((pro, i) => (
              <div key={pro.id} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-100 text-gray-600" :
                  i === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-gray-50 text-gray-400"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{pro.name}</p>
                  <p className="text-xs text-gray-400">
                    {pro.totalJobs} jobs &middot; {pro.reviewCount} reviews
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {pro.avgRating.toFixed(1)} <span className="text-yellow-500">&#9733;</span>
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {Math.round(pro.acceptanceRate * 100)}% accept
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Surveys + Waitlist */}
        <div className="space-y-5">
          {/* Survey Stats */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-3">Survey Responses</h3>
            {surveyTypes.length === 0 ? (
              <p className="text-sm text-gray-400">No surveys yet</p>
            ) : (
              <div className="space-y-2">
                {surveyTypes.map((s) => (
                  <div key={s.type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{s.type}</span>
                    <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-full">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {recentSurveys.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Latest submissions</p>
                {recentSurveys.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-600 capitalize">{s.type}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waitlist Stats */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-3">Waitlist by City</h3>
            {waitlistCities.length === 0 ? (
              <p className="text-sm text-gray-400">No waitlist signups yet</p>
            ) : (
              <div className="space-y-2">
                {waitlistCities.map((w) => (
                  <div key={w.city} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{w.city}</span>
                    <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-full">
                      {w.count} signups
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
