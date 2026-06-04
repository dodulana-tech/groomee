"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatNaira, cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "MOBILIZATION", label: "Mobilization" },
  { value: "COMPLETION_RELEASE", label: "Completion release" },
  { value: "CONFIRM_RELEASE", label: "Confirm release" },
  { value: "APPRENTICE_COMMISSION_RELEASE", label: "Apprentice commission" },
  { value: "CLAWBACK", label: "Clawback" },
  { value: "ADVANCE_DISBURSED", label: "Advance disbursed" },
  { value: "ADVANCE_REPAYMENT", label: "Advance repayment" },
  { value: "PAYOUT_DEBIT", label: "Payout debit" },
  { value: "PAYOUT_REVERSAL", label: "Payout reversal" },
  { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
  { value: "SAVINGS_SKIM", label: "Savings skim" },
  { value: "BENEFIT_PREMIUM", label: "Benefit premium" },
];

const TYPE_BADGE: Record<string, string> = {
  MOBILIZATION: "bg-blue-100 text-blue-700",
  COMPLETION_RELEASE: "bg-indigo-100 text-indigo-700",
  CONFIRM_RELEASE: "bg-emerald-100 text-emerald-700",
  APPRENTICE_COMMISSION_RELEASE: "bg-purple-100 text-purple-700",
  CLAWBACK: "bg-red-100 text-red-700",
  ADVANCE_DISBURSED: "bg-amber-100 text-amber-700",
  ADVANCE_REPAYMENT: "bg-amber-100 text-amber-800",
  PAYOUT_DEBIT: "bg-gray-200 text-gray-700",
  PAYOUT_REVERSAL: "bg-gray-100 text-gray-700",
  MANUAL_ADJUSTMENT: "bg-yellow-100 text-yellow-800",
  SAVINGS_SKIM: "bg-teal-100 text-teal-700",
  BENEFIT_PREMIUM: "bg-rose-100 text-rose-700",
};

interface MovementRow {
  id: string;
  proId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  bookingId: string | null;
  bookingRef: string | null;
  advanceId: string | null;
  payoutId: string | null;
  note: string | null;
  createdAt: string;
  pro: { id: string; name: string; phone: string } | null;
}

interface ApiResponse {
  success: boolean;
  data: MovementRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  error?: string;
}

export default function MovementsClient() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    params.set("limit", "50");
    try {
      const res = await fetch(`/api/admin/wallet/movements?${params.toString()}`);
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to load");
        return;
      }
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [type, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  function downloadCsv() {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("format", "csv");
    window.location.href = `/api/admin/wallet/movements?${params.toString()}`;
  }

  function resetFilters() {
    setType("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/wallet"
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            ← Wallets overview
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">All movements</h1>
          <p className="text-sm text-gray-500">
            System-wide ledger feed across every pro wallet.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📜</p>
            <p className="font-semibold text-gray-600">No movements match.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Date", "Pro", "Type", "Amount", "Balance after", "Booking", "Note"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const positive = r.amount >= 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(r.createdAt), "dd MMM yy, HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/wallet/${r.proId}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {r.pro?.name ?? "Unknown"}
                      </Link>
                      <p className="text-[10px] text-gray-400">{r.pro?.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          TYPE_BADGE[r.type] ?? "bg-gray-100 text-gray-600",
                        )}
                      >
                        {r.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-bold",
                        positive ? "text-emerald-700" : "text-red-600",
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatNaira(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatNaira(r.balanceAfter)}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.bookingRef ? (
                        <Link
                          href={`/admin/bookings/${r.bookingId}`}
                          className="text-brand-600 hover:underline"
                        >
                          {r.bookingRef}
                        </Link>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[300px]">
                      <p className="truncate" title={r.note ?? ""}>
                        {r.note ?? "-"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {meta.totalPages} · {meta.total} rows
          </span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
