"use client";

// Pro-side withdrawal history. Tabbed by status. Status names are kept
// internal-friendly here (Pending / Eligible / Paid / Cancelled / Failed) but
// supplemented with plain-language explanations.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Withdrawal {
  id: string;
  amount: number;
  netAmount: number;
  penaltyAmount: number;
  status: "PENDING" | "ELIGIBLE" | "PAID" | "CANCELLED" | "FAILED";
  isInstant: boolean;
  noticeUntil: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

type Tab = "all" | "PENDING" | "ELIGIBLE" | "PAID" | "CANCELLED" | "FAILED";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "ELIGIBLE", label: "Ready" },
  { id: "PAID", label: "Paid" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "FAILED", label: "Failed" },
];

function statusBadge(status: Withdrawal["status"]): { label: string; cls: string } {
  switch (status) {
    case "PENDING":
      return { label: "Pending", cls: "bg-amber-100 text-amber-700" };
    case "ELIGIBLE":
      return { label: "Ready for payout", cls: "bg-blue-100 text-blue-700" };
    case "PAID":
      return { label: "Paid", cls: "bg-green-100 text-green-700" };
    case "CANCELLED":
      return { label: "Cancelled", cls: "bg-gray-100 text-gray-600" };
    case "FAILED":
      return { label: "Failed", cls: "bg-red-100 text-red-700" };
  }
}

export default function ReserveWithdrawalsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/partner/reserve/withdrawals?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setItems(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load withdrawals");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Cancel this withdrawal? Your money returns to your available Reserve.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/reserve/withdrawals/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24">
      <div>
        <Link href="/partner/reserve" className="text-xs font-semibold text-gray-500 hover:text-gray-700">
          ← Reserve
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Withdrawals</h1>
        <p className="text-sm text-gray-500">Every request you&apos;ve made from your Reserve.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              tab === t.id
                ? "bg-brand-700 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No withdrawals here yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((w) => {
              const badge = statusBadge(w.status);
              return (
                <div key={w.id} className="px-4 sm:px-6 py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {formatNaira(w.netAmount)}
                        {w.amount !== w.netAmount && (
                          <span className="ml-1 text-xs font-medium text-gray-500">
                            (gross {formatNaira(w.amount)})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {w.isInstant ? "Instant" : "Notice"}
                        {" · "}
                        Requested{" "}
                        {new Date(w.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {w.status === "PENDING" && w.noticeUntil && (
                        <p className="text-xs text-gray-500">
                          Available{" "}
                          {new Date(w.noticeUntil).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                      {w.status === "PAID" && w.releasedAt && (
                        <p className="text-xs text-gray-500">
                          Paid{" "}
                          {new Date(w.releasedAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                      {w.status === "FAILED" && w.failureReason && (
                        <p className="text-xs text-red-600 mt-0.5">{w.failureReason}</p>
                      )}
                      {w.penaltyAmount > 0 && (
                        <p className="text-xs text-amber-700 mt-0.5">
                          Instant fee: {formatNaira(w.penaltyAmount)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {w.status === "PENDING" && (
                        <button
                          onClick={() => cancel(w.id)}
                          disabled={busy}
                          className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
