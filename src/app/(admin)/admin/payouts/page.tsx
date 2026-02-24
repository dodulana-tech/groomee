"use client";

import { useState, useEffect } from "react";
import { formatNaira } from "@/lib/utils";

interface GroomerPayoutSummary {
  groomer: {
    id: string;
    name: string;
    phone: string;
    bankName: string | null;
    bankAccountNo: string | null;
  };
  pendingAmount: number;
  earningCount: number;
  canPay: boolean;
}

export default function AdminPayoutsPage() {
  const [summaries, setSummaries] = useState<GroomerPayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [results, setResults] = useState<
    Array<{
      groomerId: string;
      success: boolean;
      amount?: number;
      reason?: string;
    }>
  >([]);

  useEffect(() => {
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((d) => setSummaries(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const payable = summaries.filter((s) => s.canPay).map((s) => s.groomer.id);
    setSelected(new Set(payable));
  }

  async function processPayouts() {
    if (selected.size === 0) return;
    if (!confirm(`Process payouts for ${selected.size} groomer(s)?`)) return;
    setPaying(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groomerIds: Array.from(selected) }),
      });
      const data = await res.json();
      setResults(data.data ?? []);
      // Refresh
      const refreshed = await fetch("/api/admin/payouts").then((r) => r.json());
      setSummaries(refreshed.data ?? []);
      setSelected(new Set());
    } finally {
      setPaying(false);
    }
  }

  const totalSelected = summaries
    .filter((s) => selected.has(s.groomer.id))
    .reduce((sum, s) => sum + s.pendingAmount, 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {summaries.length} groomers with pending earnings
            {totalSelected > 0 && ` · ${formatNaira(totalSelected)} selected`}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={selectAll} className="btn-secondary btn-md">
            Select all payable
          </button>
          <button
            onClick={processPayouts}
            disabled={paying || selected.size === 0}
            className="btn-primary btn-md"
          >
            {paying
              ? "Processing…"
              : `Pay ${selected.size > 0 ? `${selected.size} groomer${selected.size > 1 ? "s" : ""}` : "selected"}`}
          </button>
        </div>
      </div>

      {/* Results banner */}
      {results.length > 0 && (
        <div className="mb-5 rounded-xl bg-brand-50 border border-brand-200 p-4">
          <p className="font-semibold text-brand-800 mb-2">Payout results:</p>
          <div className="space-y-1">
            {results.map((r) => (
              <p key={r.groomerId} className="text-sm">
                {r.success ? (
                  <span className="text-brand-700">
                    ✓ {formatNaira(r.amount ?? 0)} sent
                  </span>
                ) : (
                  <span className="text-red-600">✗ Failed: {r.reason}</span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-3xl mb-2">💰</p>
          <p className="font-semibold text-gray-700">No pending payouts</p>
          <p className="text-sm text-gray-500 mt-1">
            All groomer earnings have been paid out.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selected.size === summaries.filter((s) => s.canPay).length
                    }
                    onChange={selectAll}
                    className="rounded border-gray-300 text-brand-600"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Groomer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bank
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Earnings
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Jobs
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaries.map((s) => (
                <tr key={s.groomer.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.groomer.id)}
                      disabled={!s.canPay}
                      onChange={() => toggleSelect(s.groomer.id)}
                      className="rounded border-gray-300 text-brand-600 disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.groomer.name}</p>
                    <p className="text-xs text-gray-400">{s.groomer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.canPay ? (
                      <span>
                        {s.groomer.bankName} ·{" "}
                        {s.groomer.bankAccountNo?.slice(-4).padStart(10, "•")}
                      </span>
                    ) : (
                      <span className="text-red-500 text-xs font-medium">
                        ⚠ Missing bank details
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {formatNaira(s.pendingAmount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.earningCount} job{s.earningCount !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3">
                    {s.canPay ? (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                        Ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                        Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
