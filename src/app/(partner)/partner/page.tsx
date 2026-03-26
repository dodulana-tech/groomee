"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface DashboardData {
  todayBookings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  pendingBalance: number;
  avgRating: number;
  reviewCount: number;
  totalJobs: number;
  acceptanceRate: number;
  tier: string;
  tierProgress: number;
  isOnline: boolean;
  activeBooking: any | null;
  upcomingBookings: any[];
}

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; next: string; requirement: string }> = {
  STANDARD: {
    label: "Standard",
    color: "text-gray-600",
    bg: "bg-gray-100",
    next: "Pro",
    requirement: "50+ jobs, 4.5+ rating",
  },
  PRO_TIER: {
    label: "Pro",
    color: "text-blue-600",
    bg: "bg-blue-100",
    next: "Elite",
    requirement: "200+ jobs, 4.8+ rating",
  },
  ELITE: {
    label: "Elite",
    color: "text-amber-600",
    bg: "bg-amber-100",
    next: "",
    requirement: "You're at the top!",
  },
};

export default function PartnerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [toggling, setToggling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  function fetchDashboard() {
    fetch("/api/partner/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setData(d.data);
          setLastUpdated(new Date());
          setSecondsAgo(0);
        }
      });
  }

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    fetchDashboard();
    const pollInterval = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(pollInterval);
  }, []);

  // Tick the "last updated X seconds ago" counter every second
  useEffect(() => {
    if (!lastUpdated) return;
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  async function toggleAvailability() {
    if (!data) return;
    setToggling(true);
    try {
      await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: data.isOnline ? "OFFLINE" : "ONLINE",
        }),
      });
      setData((d) => d ? { ...d, isOnline: !d.isOnline } : d);
    } finally {
      setToggling(false);
    }
  }

  if (!data) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl border border-white/20 p-5">
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tier = TIER_CONFIG[data.tier] ?? TIER_CONFIG.STANDARD;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header with availability toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back. Here&apos;s your overview.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
            </p>
          )}
        </div>
        <button
          onClick={toggleAvailability}
          disabled={toggling}
          className={`flex items-center gap-3 rounded-2xl px-6 py-3 font-bold text-sm transition-all shadow-lg ${
            data.isOnline
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full ${
              data.isOnline
                ? "bg-white animate-pulse"
                : "bg-gray-400"
            }`}
          />
          {data.isOnline ? "Online - accepting bookings" : "Offline"}
        </button>
      </div>

      {/* Stat cards - glassmorphism */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Today&apos;s bookings
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {data.todayBookings}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            This week
          </p>
          <p className="mt-1 text-3xl font-black text-brand-700">
            {formatNaira(data.weeklyEarnings)}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            This month
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {formatNaira(data.monthlyEarnings)}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Pending balance
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">
            {formatNaira(data.pendingBalance)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance card */}
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-4">Your performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-black text-brand-700">
                ★ {Number(data.avgRating ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">
                {data.reviewCount} reviews
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">
                {data.totalJobs}
              </p>
              <p className="text-xs text-gray-500">Total jobs</p>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">
                {(Number(data.acceptanceRate ?? 0) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">Acceptance rate</p>
            </div>
            <div>
              <p className={`text-lg font-black ${tier.color}`}>
                <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${tier.bg}`}>
                  {tier.label}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Current tier</p>
            </div>
          </div>

          {/* Tier progress */}
          {tier.next && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  Progress to <strong>{tier.next}</strong>
                </p>
                <p className="text-xs font-bold text-brand-600">
                  {(data.tierProgress * 100).toFixed(0)}%
                </p>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
                  style={{ width: `${data.tierProgress * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                Requires: {tier.requirement}
              </p>
            </div>
          )}
        </div>

        {/* Active booking / quick actions */}
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-4">Quick actions</h2>
          {data.activeBooking ? (
            <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-700 uppercase">
                  Active booking
                </span>
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {data.activeBooking.status.replace("_", " ")}
                </span>
              </div>
              <p className="font-semibold text-gray-900">
                {data.activeBooking.service}
              </p>
              <p className="text-sm text-gray-600">
                {data.activeBooking.customerArea}
              </p>
              <Link
                href={`/partner/bookings`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
              >
                View details →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">No active booking right now.</p>
          )}

          <div className="space-y-2">
            <Link
              href="/partner/bookings"
              className="flex items-center gap-3 glass-card rounded-xl p-3 text-sm font-semibold text-gray-700 hover:bg-white/90 transition"
            >
              📋 View all bookings
            </Link>
            <Link
              href="/partner/earnings"
              className="flex items-center gap-3 glass-card rounded-xl p-3 text-sm font-semibold text-gray-700 hover:bg-white/90 transition"
            >
              💰 View earnings
            </Link>
            <Link
              href="/partner/schedule"
              className="flex items-center gap-3 glass-card rounded-xl p-3 text-sm font-semibold text-gray-700 hover:bg-white/90 transition"
            >
              📅 Manage schedule
            </Link>
            <Link
              href="/partner/growth"
              className="flex items-center gap-3 glass-card rounded-xl p-3 text-sm font-semibold text-gray-700 hover:bg-white/90 transition"
            >
              📈 Growth &amp; tips
            </Link>
          </div>
        </div>
      </div>

      {/* Why Groomee - value reminder for vendors */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">What Groomee does for you</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "💰", title: "Predictable income", desc: "No chasing clients. Groomee brings demand to you." },
            { icon: "📊", title: "Free business tools", desc: "Calendar, earnings tracker, automated payouts." },
            { icon: "📈", title: "Professional growth", desc: "Tier system with increasing benefits and visibility." },
            { icon: "🏦", title: "Financial safety net", desc: "Advance/float for emergencies, base insurance." },
            { icon: "🛡️", title: "Dignity & protection", desc: "ID-verified customers, dispute resolution." },
            { icon: "📱", title: "Work from anywhere", desc: "No salon rent. Manage via WhatsApp + web." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl bg-white/60 p-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
