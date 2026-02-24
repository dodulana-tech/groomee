"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: "📊", exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: "📋" },
  { href: "/admin/groomers", label: "Groomers", icon: "💇" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/disputes", label: "Disputes", icon: "⚠️" },
  { href: "/admin/advances", label: "Advances", icon: "💰" },
  { href: "/admin/payouts", label: "Payouts", icon: "💸" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "🌿" },
  { href: "/admin/catalog", label: "Services", icon: "🗂️" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-gray-900">
      {/* Brand */}
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/admin">
          <span className="font-display text-lg font-black text-green-400">
            Groomee
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Ops Dashboard
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && item.href !== "/admin";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
                isActive
                  ? "bg-green-500/15 text-green-400"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70",
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors py-1"
        >
          ← Back to main site
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/auth";
          }}
          className="flex w-full items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors py-1"
        >
          ⎋ Sign out
        </button>
      </div>
    </aside>
  );
}
