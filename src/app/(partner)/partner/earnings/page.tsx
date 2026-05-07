"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/utils";

export default function PartnerEarningsPage() {
  const [data, setData] = useState<any>(null);

  const [fetchError, setFetchError] = useState("");

  function loadEarnings() {
    setFetchError("");
    fetch("/api/partner/earnings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .catch(() => setFetchError("Could not load earnings. Tap to retry."));
  }

  useEffect(() => { loadEarnings(); }, []);

  if (!data) {
    return (
      <div className="p-8 space-y-6">
        {fetchError ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">{fetchError}</p>
            <button onClick={loadEarnings} className="btn-primary btn-sm">Retry</button>
          </div>
        ) : (
          <>
            <div className="skeleton h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500">Track your income and payouts.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Total earned
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {formatNaira(data.totalEarned)}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Pending
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">
            {formatNaira(data.pendingBalance)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Next payout: {data.nextPayoutDate ?? "TBD"}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Paid out
          </p>
          <p className="mt-1 text-3xl font-black text-green-600">
            {formatNaira(data.totalPaidOut)}
          </p>
        </div>
      </div>

      {/* Apprentice earnings breakdown — only renders when the pro has masters work via apprentices */}
      {data.breakdown?.apprenticeCommission > 0 && (
        <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Earnings from your apprentices</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Commission paid to you on every job your apprentices complete.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Your own work
              </p>
              <p className="mt-1 text-xl font-black text-gray-900">
                {formatNaira(data.breakdown.service)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Apprentice commission
              </p>
              <p className="mt-1 text-xl font-black text-brand-700">
                {formatNaira(data.breakdown.apprenticeCommission)}
              </p>
            </div>
          </div>
          {data.apprenticeContributors?.length > 0 && (
            <div className="divide-y divide-gray-100">
              {data.apprenticeContributors.map((c: any) => (
                <div
                  key={c.apprenticeId}
                  className="flex items-center justify-between px-4 sm:px-6 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.jobs} {c.jobs === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-bold text-brand-700">
                    +{formatNaira(c.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Earnings history */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent earnings</h2>
        </div>
        {data.recentEarnings?.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {data.recentEarnings.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {e.serviceName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                    {e.type === "APPRENTICE_COMMISSION" ? " · apprentice commission" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-brand-700">
                    +{formatNaira(e.amount)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {e.paid ? "✅ Paid" : "⏳ Pending"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No earnings yet. Complete your first booking!</p>
          </div>
        )}
      </div>

      {/* Bank details */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">Bank details</h2>
        {data.bankName ? (
          <div className="text-sm text-gray-600">
            <p>
              {data.bankName} · ••••{data.bankAccountLast4}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Payouts are processed weekly on Fridays.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              No bank details on file. Add your account to receive payouts.
            </p>
            <a
              href="/partner/profile"
              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
            >
              Add bank details →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
