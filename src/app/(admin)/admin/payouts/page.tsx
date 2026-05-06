"use client";

import { useState, useEffect, useCallback } from "react";
import { formatNaira } from "@/lib/utils";

interface ProPayoutSummary {
  pro: {
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

interface PayoutHistoryRow {
  id: string;
  amount: number;
  status: string;
  paystackTransferId: string | null;
  failureReason: string | null;
  periodStart: string;
  periodEnd: string;
  processedAt: string | null;
  createdAt: string;
  pro: { id: string; name: string; phone: string };
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  SUCCESS: { bg: "#DCFCE7", color: "#166534" },
  PROCESSING: { bg: "#FEF3C7", color: "#B45309" },
  FAILED: { bg: "#FEF2F2", color: "#991B1B" },
};

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [summaries, setSummaries] = useState<ProPayoutSummary[]>([]);
  const [history, setHistory] = useState<PayoutHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [results, setResults] = useState<
    Array<{
      proId: string;
      success: boolean;
      amount?: number;
      reason?: string;
    }>
  >([]);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/history?page=${page}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
        setHistoryTotalPages(data.meta?.totalPages ?? 1);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory(historyPage);
  }, [tab, historyPage, fetchHistory]);

  async function retryPayout(id: string) {
    if (!confirm("Retry this payout? Paystack will be called again.")) return;
    setRetrying(id);
    try {
      const res = await fetch(`/api/admin/payouts/${id}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error ?? "Retry failed");
      }
      fetchHistory(historyPage);
    } finally {
      setRetrying(null);
    }
  }

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
    const payable = summaries.filter((s) => s.canPay).map((s) => s.pro.id);
    setSelected((prev) =>
      prev.size === payable.length ? new Set() : new Set(payable),
    );
  }

  async function processPayouts() {
    if (selected.size === 0) return;
    if (!confirm(`Process payouts for ${selected.size} pro(s)?`)) return;
    setPaying(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proIds: Array.from(selected) }),
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
    .filter((s) => selected.has(s.pro.id))
    .reduce((sum, s) => sum + s.pendingAmount, 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === "pending"
              ? `${summaries.length} pros with pending earnings`
              : "Past payouts and their statuses"}
            {tab === "pending" && totalSelected > 0 && ` · ${formatNaira(totalSelected)} selected`}
          </p>
        </div>
        {tab === "pending" && (
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
                : `Pay ${selected.size > 0 ? `${selected.size} pro${selected.size > 1 ? "s" : ""}` : "selected"}`}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "pending" ? "Pending" : "History"}
          </button>
        ))}
      </div>

      {/* Results banner */}
      {results.length > 0 && (
        <div className="mb-5 rounded-xl bg-brand-50 border border-brand-200 p-4">
          <p className="font-semibold text-brand-800 mb-2">Payout results:</p>
          <div className="space-y-1">
            {results.map((r) => (
              <p key={r.proId} className="text-sm">
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

      {tab === "history" ? (
        <PayoutHistoryView
          rows={history}
          loading={historyLoading}
          page={historyPage}
          totalPages={historyTotalPages}
          onPageChange={setHistoryPage}
          onRetry={retryPayout}
          retrying={retrying}
        />
      ) : loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-3xl mb-2">💰</p>
          <p className="font-semibold text-gray-700">No pending payouts</p>
          <p className="text-sm text-gray-500 mt-1">
            All pro earnings have been paid out.
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
                  Pro
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
                <tr key={s.pro.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.pro.id)}
                      disabled={!s.canPay}
                      onChange={() => toggleSelect(s.pro.id)}
                      className="rounded border-gray-300 text-brand-600 disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.pro.name}</p>
                    <p className="text-xs text-gray-400">{s.pro.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.canPay ? (
                      <span>
                        {s.pro.bankName} ·{" "}
                        {s.pro.bankAccountNo?.slice(-4).padStart(10, "•")}
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

function PayoutHistoryView({
  rows,
  loading,
  page,
  totalPages,
  onPageChange,
  onRetry,
  retrying,
}: {
  rows: PayoutHistoryRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onRetry: (id: string) => void;
  retrying: string | null;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="card py-12 text-center">
        <p className="text-3xl mb-2">📜</p>
        <p className="font-semibold text-gray-700">No payouts yet</p>
        <p className="text-sm text-gray-500 mt-1">Past payouts will appear here once you process some.</p>
      </div>
    );
  }
  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {["Pro", "Amount", "Period", "Status", "Created", "Processed", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.PROCESSING;
              return (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{r.pro.name}</p>
                    <p className="text-xs text-gray-400">{r.pro.phone}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">{formatNaira(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.periodStart).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    →{" "}
                    {new Date(r.periodEnd).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {r.status}
                    </span>
                    {r.failureReason && (
                      <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={r.failureReason}>
                        {r.failureReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {r.processedAt
                      ? new Date(r.processedAt).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "FAILED" && (
                      <button
                        onClick={() => onRetry(r.id)}
                        disabled={retrying === r.id}
                        className="text-xs font-bold text-white bg-brand-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50 hover:bg-brand-700"
                      >
                        {retrying === r.id ? "Retrying…" : "Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-xl px-4 py-2 font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-xl px-4 py-2 font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
