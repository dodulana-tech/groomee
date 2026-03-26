"use client";

import { useState } from "react";
import Link from "next/link";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/partner", label: "Dashboard", icon: "📊", exact: true },
  { href: "/partner/bookings", label: "Bookings", icon: "📋" },
  { href: "/partner/earnings", label: "Earnings", icon: "💰" },
  { href: "/partner/schedule", label: "Schedule", icon: "📅" },
  { href: "/partner/profile", label: "Profile", icon: "👤" },
  { href: "/partner/growth", label: "Growth", icon: "📈" },
];

export default function PartnerSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="border-b border-white/10 px-5 py-5">
      <Link href="/partner" className="flex items-center gap-2.5">
        <img
          src={LOGO_TEAL_BASE64}
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
            Partner Portal
          </span>
        </div>
      </Link>
    </div>
  );

  const valueProp = (
    <div className="mx-3 mt-3 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-0.5">
        Your business tools
      </p>
      <p className="text-[10px] text-white/40 leading-relaxed">
        Manage bookings, track earnings, and grow your client base - all in one place.
      </p>
    </div>
  );

  const navItems = (
    <nav className="flex-1 overflow-y-auto p-3 mt-2">
      {NAV.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href) && item.href !== "/partner";
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
  );

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg" onClick={() => setOpen(true)}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-56 shrink-0 flex-col bg-gray-950">
        {brand}
        {valueProp}
        {navItems}
        {footer}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-gray-950">
            <button className="absolute top-4 right-4 text-white/50 hover:text-white" onClick={() => setOpen(false)}>✕</button>
            {brand}
            {valueProp}
            {navItems}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
