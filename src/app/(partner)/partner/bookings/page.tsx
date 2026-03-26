"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

type Tab = "upcoming" | "active" | "completed";

export default function PartnerBookingsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/partner/bookings?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        setBookings(d.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "active", label: "Active", icon: "🔴" },
    { key: "upcoming", label: "Upcoming", icon: "📅" },
    { key: "completed", label: "Completed", icon: "✅" },
  ];

  async function updateStatus(bookingId: string, status: string) {
    const res = await fetch(`/api/partner/bookings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Failed");
      return;
    }
    // Re-fetch current tab
    const listRes = await fetch(`/api/partner/bookings?tab=${tab}`);
    const listData = await listRes.json();
    setBookings(listData.data ?? []);
  }

  const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
    ACCEPTED: { label: "🚗 On My Way", next: "EN_ROUTE", color: "bg-blue-600 text-white" },
    EN_ROUTE: { label: "📍 I've Arrived", next: "ARRIVED", color: "bg-brand-600 text-white" },
    ARRIVED: { label: "✨ Start Service", next: "IN_SERVICE", color: "bg-brand-600 text-white" },
    IN_SERVICE: { label: "✅ Service Complete", next: "COMPLETED", color: "bg-green-600 text-white" },
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500">Manage your service appointments.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "glass-card text-gray-600 hover:border-brand-200"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl border border-white/20 p-5">
              <div className="skeleton h-5 w-1/3 mb-2" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass rounded-2xl border border-white/20 p-8 text-center shadow-lg">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold text-gray-900">No {tab} bookings</p>
          <p className="text-sm text-gray-500 mt-1">
            {tab === "active"
              ? "You don't have any active bookings right now."
              : tab === "upcoming"
                ? "No upcoming appointments scheduled."
                : "Your completed bookings will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b: any) => (
            <div
              key={b.id}
              className="glass rounded-2xl border border-white/20 p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 uppercase">
                      {b.status?.replace("_", " ")}
                    </span>
                    {b.isAsap && (
                      <span className="rounded-full bg-accent-50 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
                        ⚡ ASAP
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">{b.serviceName}</p>
                  <p className="text-sm text-gray-500">
                    {b.customerFirstName} · {b.areaName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(b.createdAt).toLocaleDateString("en-NG", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-brand-700">
                    {formatNaira(b.proEarning)}
                  </p>
                  {STATUS_ACTIONS[b.status] && (
                    <button
                      onClick={() =>
                        updateStatus(b.id, STATUS_ACTIONS[b.status].next)
                      }
                      className={`mt-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${STATUS_ACTIONS[b.status].color} hover:opacity-90`}
                    >
                      {STATUS_ACTIONS[b.status].label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
