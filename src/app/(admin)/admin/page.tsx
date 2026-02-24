import Link from "next/link";

const KPIS = [
  {
    icon: "💰",
    label: "Today's revenue",
    value: "₦342k",
    change: "+18%",
    up: true,
    color: "green",
  },
  {
    icon: "⚡",
    label: "Active bookings",
    value: "12",
    change: "3 new",
    up: true,
    color: "orange",
  },
  {
    icon: "💇",
    label: "Groomers online",
    value: "28",
    change: "↑ 4 since 9am",
    up: true,
    color: "blue",
  },
  {
    icon: "⚠️",
    label: "Open disputes",
    value: "2",
    change: "Needs review",
    up: false,
    color: "red",
  },
];

const BAR_DATA = [
  { day: "Mon", h1: 55, h2: 72 },
  { day: "Tue", h1: 40, h2: 58 },
  { day: "Wed", h1: 70, h2: 88 },
  { day: "Thu", h1: 48, h2: 65 },
  { day: "Fri", h1: 82, h2: 105 },
  { day: "Sat", h1: 90, h2: 118 },
  { day: "Sun", h1: 60, h2: 78, dim: true },
];

const BOOKINGS = [
  {
    customer: "Temi A.",
    service: "Knotless Braids",
    groomer: "Chidinma A.",
    zone: "Victoria Island",
    status: "EN_ROUTE",
    amount: 14400,
  },
  {
    customer: "Bola O.",
    service: "Full Glam Makeup",
    groomer: "Shade M.",
    zone: "Lekki Phase 1",
    status: "IN_SERVICE",
    amount: 22000,
  },
  {
    customer: "Kemi F.",
    service: "Gel Nails",
    groomer: "—",
    zone: "Ikeja",
    status: "DISPATCHING",
    amount: 8000,
  },
  {
    customer: "Adaeze N.",
    service: "Haircut & Fade",
    groomer: "Emeka O.",
    zone: "Yaba",
    status: "CONFIRMED",
    amount: 5000,
  },
  {
    customer: "Funke A.",
    service: "Volume Lashes",
    groomer: "Blessing T.",
    zone: "Ikoyi",
    status: "ARRIVED",
    amount: 18000,
  },
];

const GROOMERS_LIVE = [
  { name: "Chidinma A.", status: "BUSY", zone: "VI", rating: 4.9, icon: "💇‍♀️" },
  { name: "Shade M.", status: "BUSY", zone: "Lekki", rating: 4.7, icon: "💄" },
  { name: "Emeka O.", status: "BUSY", zone: "Yaba", rating: 4.8, icon: "✂️" },
  {
    name: "Ngozi P.",
    status: "ONLINE",
    zone: "Ikeja",
    rating: 4.8,
    icon: "💅",
  },
  {
    name: "Blessing T.",
    status: "ONLINE",
    zone: "Ikoyi",
    rating: 4.6,
    icon: "👁️",
  },
  { name: "Adaora J.", status: "OFFLINE", zone: "—", rating: 4.5, icon: "💇‍♀️" },
];

const STATUS_STYLE: Record<string, string> = {
  EN_ROUTE: "bg-forest-50 text-forest-700",
  IN_SERVICE: "bg-blue-50 text-blue-700",
  DISPATCHING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-gray-100 text-gray-500",
  ARRIVED: "bg-purple-50 text-purple-700",
};
const STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "En route",
  IN_SERVICE: "In service",
  DISPATCHING: "Finding groomer",
  CONFIRMED: "Complete",
  ARRIVED: "Arrived",
};

export default function AdminDashboard() {
  const now = new Date();

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
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-card">
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
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900">Bookings this week</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Hair services vs all services
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500" /> Hair
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-100" /> All
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-36">
            {BAR_DATA.map((d) => (
              <div key={d.day} className="flex-1 flex gap-1 items-end">
                <div
                  className={`flex-1 rounded-t-md bg-green-500 transition-all ${d.dim ? "opacity-30" : ""}`}
                  style={{ height: `${d.h1}px` }}
                />
                <div
                  className={`flex-1 rounded-t-md bg-green-100 transition-all ${d.dim ? "opacity-30" : ""}`}
                  style={{ height: `${d.h2}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            {BAR_DATA.map((d) => (
              <div
                key={d.day}
                className="flex-1 text-center text-[10px] text-gray-400"
              >
                {d.day}
              </div>
            ))}
          </div>
        </div>

        {/* Live groomer availability */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Groomer availability</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="space-y-2.5">
            {GROOMERS_LIVE.map((g) => (
              <div key={g.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-base">
                  {g.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {g.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {g.zone} · ★ {g.rating}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    g.status === "ONLINE"
                      ? "bg-green-50 text-green-700"
                      : g.status === "BUSY"
                        ? "bg-orange-50 text-orange-600"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {g.status === "ONLINE"
                    ? "Online"
                    : g.status === "BUSY"
                      ? "Busy"
                      : "Offline"}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/admin/groomers"
            className="block mt-4 text-center text-xs font-semibold text-green-600 hover:underline"
          >
            View all groomers →
          </Link>
        </div>
      </div>

      {/* Live bookings table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h3 className="font-bold text-gray-900">Live bookings</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing 5 of 12 active
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  "Customer",
                  "Service",
                  "Groomer",
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
              {BOOKINGS.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-gray-800">{b.customer}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{b.service}</td>
                  <td className="px-5 py-3.5 text-gray-600">{b.groomer}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {b.zone}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-800">
                    ₦{b.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    {b.status === "DISPATCHING" ? (
                      <button className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                        ⚠ Assign
                      </button>
                    ) : (
                      <button className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
