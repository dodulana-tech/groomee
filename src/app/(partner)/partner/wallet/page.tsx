"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira, cn } from "@/lib/utils";
import { MOVEMENT_LABEL, MOVEMENT_BADGE } from "@/lib/wallet-labels";
import type { WalletMovementType } from "@prisma/client";

interface SummaryData {
  available: number;
  pending: number;
  netAdvanceOwed: number;
  creditLimit: number;
  fractions: { mobilization: number; completion: number; confirm: number };
  lastMovementAt: string | null;
}

interface LedgerRow {
  id: string;
  type: WalletMovementType;
  amount: number;
  balanceAfter: number;
  bookingId: string | null;
  bookingRef: string | null;
  note: string | null;
  createdAt: string;
}

export default function PartnerWalletPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [howOpen, setHowOpen] = useState(false);

  function load() {
    setFetchError("");
    Promise.all([
      fetch("/api/partner/wallet/summary").then((r) => r.json()),
      fetch("/api/partner/wallet/ledger?limit=20").then((r) => r.json()),
    ])
      .then(([s, l]) => {
        if (s.success) setSummary(s.data);
        if (l.success) setRows(l.data.rows);
      })
      .catch(() => setFetchError("Could not load wallet. Tap to retry."));
  }

  useEffect(() => {
    load();
  }, []);

  if (!summary) {
    return (
      <div className="p-8 space-y-6">
        {fetchError ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">{fetchError}</p>
            <button onClick={load} className="btn-primary btn-sm">Retry</button>
          </div>
        ) : (
          <>
            <div className="skeleton h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass rounded-2xl border border-white/20 p-5">
                  <div className="skeleton h-4 w-20 mb-2" />
                  <div className="skeleton h-8 w-32" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const mobPct = Math.round(summary.fractions.mobilization * 100);
  const compPct = Math.round(summary.fractions.completion * 100);
  const confPct = 100 - mobPct - compPct;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Wallet</h1>
          <p className="text-sm text-gray-500">
            Every naira you earn lands here as it moves through each booking.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/partner/wallet/history"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Full history
          </Link>
          <Link
            href="/partner/wallet/advances"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            style={{ backgroundColor: "#014342" }}
          >
            Advances
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Available
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-black",
              summary.available < 0 ? "text-red-600" : "text-gray-900",
            )}
          >
            {formatNaira(summary.available)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            What you&apos;ve already earned and can be paid out.
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Pending
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">
            {formatNaira(summary.pending)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            In-flight bookings still releasing to you.
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Net advance owed
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-black",
              summary.netAdvanceOwed > 0 ? "text-amber-700" : "text-gray-900",
            )}
          >
            {formatNaira(summary.netAdvanceOwed)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Auto-deducted from each weekly payout.
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Credit limit
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {formatNaira(summary.creditLimit)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            How low your balance can go on clawbacks.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Recent activity</h2>
            <Link
              href="/partner/wallet/history"
              className="text-xs font-semibold text-brand-700 hover:underline"
              style={{ color: "#014342" }}
            >
              See all →
            </Link>
          </div>
          {rows && rows.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {rows.map((r) => {
                const positive = r.amount >= 0;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            MOVEMENT_BADGE[r.type] ?? "bg-gray-100 text-gray-600",
                          )}
                        >
                          {MOVEMENT_LABEL[r.type]}
                        </span>
                        {r.bookingRef && (
                          <Link
                            href="/partner/bookings"
                            className="text-[10px] font-semibold text-gray-400 hover:text-brand-700"
                          >
                            {r.bookingRef}
                          </Link>
                        )}
                      </div>
                      {r.note && (
                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                          {r.note}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "font-mono text-sm font-bold",
                          positive ? "text-emerald-700" : "text-red-600",
                        )}
                      >
                        {positive ? "+" : ""}
                        {formatNaira(r.amount)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        bal {formatNaira(r.balanceAfter)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center px-5">
              <p className="text-3xl mb-2">👛</p>
              <p className="font-semibold text-gray-700">No wallet activity yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Accept your first booking and you&apos;ll see transport money land
                here right away.
              </p>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Need cash now */}
          <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
            <h3 className="font-bold text-gray-900">Need cash now?</h3>
            <p className="mt-1 text-sm text-gray-600">
              Take an advance against your future earnings. We&apos;ll deduct it
              gradually from your weekly payouts — no panic, no chasing.
            </p>
            <Link
              href="/partner/wallet/advances"
              className="mt-4 inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: "#c8871a" }}
            >
              Request an advance →
            </Link>
          </div>

          {/* How it flows */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setHowOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <h3 className="font-bold text-gray-900">How your earnings flow</h3>
                <p className="text-xs text-gray-500">
                  Tap to see the three release moments.
                </p>
              </div>
              <span className="text-gray-400 text-lg">{howOpen ? "−" : "+"}</span>
            </button>
            {howOpen && (
              <div className="px-5 pb-5 space-y-3 text-sm text-gray-700">
                <p>
                  Your money lands in your wallet across three moments — so you
                  have transport cash up front and don&apos;t wait until the end.
                </p>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs font-bold uppercase text-blue-700 tracking-wide">
                    1 · Transport advance
                  </p>
                  <p className="text-sm text-blue-900 mt-1">
                    <strong>{mobPct}%</strong> the moment you accept the booking.
                    For fuel, supplies, or taxi.
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-xs font-bold uppercase text-indigo-700 tracking-wide">
                    2 · Service complete
                  </p>
                  <p className="text-sm text-indigo-900 mt-1">
                    <strong>{compPct}%</strong> when you mark the job done.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-xs font-bold uppercase text-emerald-700 tracking-wide">
                    3 · Final release
                  </p>
                  <p className="text-sm text-emerald-900 mt-1">
                    <strong>{confPct}%</strong> once the customer confirms — usually
                    minutes later.
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  If a booking is cancelled or refunded, the matching slices are
                  reversed and you&apos;ll see a Reversal row in your history.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
