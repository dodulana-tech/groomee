"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: "📊", exact: true, permission: "dashboard.view" },
  { href: "/admin/bookings", label: "Bookings", icon: "📋", permission: "bookings.view" },
  { href: "/admin/pros", label: "Beauty Pros", icon: "💇", permission: "pros.view" },
  { href: "/admin/customers", label: "Customers", icon: "👥", permission: "customers.view" },
  { href: "/admin/disputes", label: "Disputes", icon: "⚠️", permission: "disputes.view" },
  { href: "/admin/advances", label: "Advances", icon: "💰", permission: "advances.view" },
  { href: "/admin/payouts", label: "Payouts", icon: "💸", permission: "payouts.view" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "🌿", permission: "subscriptions.view" },
  { href: "/admin/catalog", label: "Services", icon: "🗂️", permission: "catalog.view" },
  { href: "/admin/surveys", label: "Surveys", icon: "📊", permission: "analytics.view" },
  { href: "/admin/waitlist", label: "Waitlist", icon: "📋", permission: "analytics.view" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈", permission: "analytics.view" },
  { href: "/admin/team", label: "Team", icon: "🔑", permission: "team.view" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", permission: "settings.view" },
];

function canAccess(permissions: string[], required: string): boolean {
  return permissions.includes("*") || permissions.includes(required);
}

export default function AdminSidebar({
  permissions,
  roleName,
}: {
  permissions: string[];
  roleName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="border-b border-white/10 px-5 py-5">
      <Link href="/admin" className="flex items-center gap-2.5">
        <Image
          src="/assets/logo/groomee-logo-teal.jpg"
          alt="Groomee"
          width={32}
          height={32}
          className="rounded-full"
        />
        <div>
          <span className="font-display text-lg font-black leading-tight text-green-400">
            Groomee
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Ops Dashboard
          </span>
        </div>
      </Link>
    </div>
  );

  const visibleNav = NAV.filter((item) => canAccess(permissions, item.permission));

  const navItems = (
    <nav className="flex-1 overflow-y-auto p-3">
      {visibleNav.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href) && item.href !== "/admin";
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
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
  );

  const footer = (
    <div className="border-t border-white/10 p-4 space-y-2">
      <div className="px-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 bg-white/5 px-2 py-0.5 rounded-full">
          {roleName}
        </span>
      </div>
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
  );

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg" onClick={() => setOpen(true)}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-56 shrink-0 flex-col bg-gray-900">
        {brand}
        {navItems}
        {footer}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-gray-900">
            <button className="absolute top-4 right-4 text-white/50 hover:text-white" onClick={() => setOpen(false)}>✕</button>
            {brand}
            {navItems}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
