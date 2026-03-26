"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/utils";

export default function PartnerEarningsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/partner/earnings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      });
  }, []);

  if (!data) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl border border-white/20 p-5">
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-8 w-32" />
            </div>
          ))}
        </div>
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
