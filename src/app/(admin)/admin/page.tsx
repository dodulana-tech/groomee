import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export const revalidate = 0;

const STATUS_STYLE: Record<string, string> = {
  EN_ROUTE: "bg-forest-50 text-forest-700",
  IN_SERVICE: "bg-blue-50 text-blue-700",
  DISPATCHING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-gray-100 text-gray-500",
  ARRIVED: "bg-purple-50 text-purple-700",
  ACCEPTED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "En route",
  IN_SERVICE: "In service",
  DISPATCHING: "Finding pro",
  CONFIRMED: "Complete",
  ARRIVED: "Arrived",
  ACCEPTED: "Accepted",
  CANCELLED: "Cancelled",
};

function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`;
  return `₦${amount.toLocaleString()}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminDashboard() {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const now = new Date();
  const today = startOfDay(now);
  const sevenDaysAgo = subDays(today, 6);

  const [
    todayRevenueAgg,
    activeBookings,
    prosOnline,
    openDisputes,
    weeklyData,
    recentBookings,
    proAvailability,
  ] = await Promise.all([
    db.payment.aggregate({
      where: { status: "CAPTURED", capturedAt: { gte: today } },
      _sum: { amount: true },
    }),
    db.booking.count({
      where: {
        status: {
          in: ["DISPATCHING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE"],
        },
      },
    }),
    db.pro.count({ where: { availability: "ONLINE", status: "ACTIVE" } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.booking.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    db.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: {
        status: {
          in: ["DISPATCHING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE"],
        },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        pro: { select: { name: true } },
        service: { select: { name: true } },
        zone: { select: { name: true } },
      },
    }),
    db.pro.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ availability: "asc" }, { avgRating: "desc" }],
      take: 6,
    }),
  ]);

  const todayRevenue = todayRevenueAgg._sum.amount ?? 0;

  // Build weekly bar chart data — one entry per day for the last 7 days
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
      dayMap[key].revenue += (row._sum.totalAmount as number | null) ?? 0;
    }
  }
  const weeklyBookings = Object.entries(dayMap).map(([isoDay, data]) => ({
    isoDay,
    label: DAY_LABELS[new Date(isoDay + "T00:00:00").getDay()],
    ...data,
  }));

  // Normalise bar heights relative to max count (min height 4px to stay visible)
  const maxCount = Math.max(...weeklyBookings.map((d) => d.count), 1);
  const MAX_BAR_PX = 120;

  const KPIS = [
    {
      icon: "💰",
      label: "Today's revenue",
      value: formatNaira(todayRevenue),
      change: todayRevenue > 0 ? "Live total" : "No data yet",
      up: todayRevenue > 0,
      color: "green",
    },
    {
      icon: "⚡",
      label: "Active bookings",
      value: String(activeBookings),
      change: activeBookings > 0 ? `${activeBookings} live` : "None live",
      up: activeBookings > 0,
      color: "orange",
    },
    {
      icon: "💇",
      label: "Pros online",
      value: String(prosOnline),
      change: prosOnline > 0 ? "Available now" : "None online",
      up: prosOnline > 0,
      color: "blue",
    },
    {
      icon: "⚠️",
      label: "Open disputes",
      value: String(openDisputes),
      change: openDisputes > 0 ? "Needs review" : "All clear",
      up: openDisputes === 0,
      color: "red",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Good{" "}
            {now.getHours() < 12
              ? "morning"
              : now.getHours() < 17
                ? "afternoon"
                : "evening"}
            , Amaka 👋
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {now.toLocaleDateString("en-NG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · Lagos operations
          </p>
        </div>
        <button className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          Export report ↓
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                  kpi.color === "green"
                    ? "bg-green-50"
                    : kpi.color === "orange"
                      ? "bg-orange-50"
                      : kpi.color === "blue"
                        ? "bg-blue-50"
                        : "bg-red-50"
                }`}
              >
                {kpi.icon}
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  kpi.up
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {kpi.change}
              </span>
            </div>
            <div className="text-2xl font-black text-gray-900">{kpi.value}</div>
            <div className="text-sm text-gray-400 mt-0.5 font-medium">
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Dispatch */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* Bar chart */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900">Bookings this week</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Daily booking count · last 7 days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500" /> Bookings
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-36">
            {weeklyBookings.map((d) => {
              const barH = Math.max(
                4,
                Math.round((d.count / maxCount) * MAX_BAR_PX),
              );
              const isToday =
                d.isoDay === today.toISOString().slice(0, 10);
              return (
                <div
                  key={d.isoDay}
                  className="flex-1 flex flex-col items-center gap-1 items-end"
                >
                  <div
                    title={`${d.count} booking${d.count !== 1 ? "s" : ""} · ${formatNaira(d.revenue)}`}
                    className={`w-full rounded-t-md transition-all ${isToday ? "bg-green-500" : "bg-green-200"}`}
                    style={{ height: `${barH}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-2">
            {weeklyBookings.map((d) => (
              <div
                key={d.isoDay}
                className="flex-1 text-center text-[10px] text-gray-400"
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>

        {/* Live pro availability */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Pro availability</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="space-y-2.5">
            {proAvailability.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No active pros yet
              </p>
            )}
            {proAvailability.map((pro) => (
              <div key={pro.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-base">
                  💇
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {pro.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    ★ {pro.avgRating.toFixed(1)} · {pro.totalJobs} jobs
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pro.availability === "ONLINE"
                      ? "bg-green-50 text-green-700"
                      : pro.availability === "BUSY"
                        ? "bg-orange-50 text-orange-600"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {pro.availability === "ONLINE"
                    ? "Online"
                    : pro.availability === "BUSY"
                      ? "Busy"
                      : "Offline"}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/admin/pros"
            className="block mt-4 text-center text-xs font-semibold text-green-600 hover:underline"
          >
            View all pros →
          </Link>
        </div>
      </div>

      {/* Live bookings table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h3 className="font-bold text-gray-900">Live bookings</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeBookings > 0
                ? `Showing ${recentBookings.length} of ${activeBookings} active`
                : "No active bookings right now"}
            </p>
          </div>
          <Link
            href="/admin/bookings"
            className="text-sm font-semibold text-green-600 hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-5 overflow-x-auto">
          {recentBookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No active bookings at the moment
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Customer",
                    "Service",
                    "Pro",
                    "Zone",
                    "Status",
                    "Value",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">
                        {b.customer?.name ?? b.customer?.phone ?? "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {b.service?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {b.pro?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {b.zone?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[b.status] ?? "bg-gray-100 text-gray-500"}`}
                      >
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-800">
                      ₦{b.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      {b.status === "DISPATCHING" ? (
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          ⚠ Assign
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
