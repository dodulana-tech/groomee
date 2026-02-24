"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/bookings": "Bookings",
  "/admin/groomers": "Groomers",
  "/admin/customers": "Customers",
  "/admin/disputes": "Disputes",
  "/admin/payouts": "Payouts",
  "/admin/catalog": "Service Catalog",
  "/admin/settings": "Settings",
};

export default function AdminTopbar() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <h1 className="font-bold text-lg text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
        <button className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-600 transition-colors">
          + Add groomer
        </button>
      </div>
    </div>
  );
}
