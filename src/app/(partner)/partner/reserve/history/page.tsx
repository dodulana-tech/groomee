"use client";

// Reserve full activity history. Client-side paginated via the movements API
// cursor. Filter chips collapse the SavingsMovementType enum into four user
// groups so pros never see internal type names.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Movement {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

const MOVEMENT_LABEL: Record<string, string> = {
  SKIM: "Set aside",
  MATCH_BONUS: "Loyalty bonus",
  INTEREST_CREDIT: "Yield",
  WITHDRAWAL_REQUEST: "Withdrawal requested",
  WITHDRAWAL_RELEASED: "Withdrawn to bank",
  WITHDRAWAL_CANCELLED: "Withdrawal cancelled",
  ADJUSTMENT: "Adjustment",
  CLAWBACK: "Reversed",
  EARLY_BREAK_PENALTY: "Instant fee",
};

const FILTERS: { id: string; label: string; group: string }[] = [
  { id: "all", label: "All", group: "" },
  { id: "skim", label: "Set-aside", group: "skim" },
  { id: "bonus", label: "Bonuses", group: "bonus" },
  { id: "withdrawal", label: "Withdrawals", group: "withdrawal" },
  { id: "adjust", label: "Adjustments", group: "adjust" },
];

export default function ReserveHistoryPage() {
  const [filter, setFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<Movement[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        const group = FILTERS.find((f) => f.id === filter)?.group;
        if (group) params.set("typeGroup", group);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (!reset && nextCursor) params.set("cursor", nextCursor);
        const res = await fetch(`/api/partner/reserve/movements?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Failed");
        setItems((prev) => (reset ? data.data.items : [...prev, ...data.data.items]));
        setNextCursor(data.data.nextCursor);
        setHasMore(data.data.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load history");
      } finally {
        setLoading(false);
      }
    },
    [filter, from, to, nextCursor],
  );

  useEffect(() => {
    // Reset whenever filter/date changes.
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, from, to]);

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/partner/reserve" className="text-xs font-semibold text-gray-500 hover:text-gray-700">
            ← Reserve
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Activity</h1>
          <p className="text-sm text-gray-500">Everything that&apos;s moved through your Reserve.</p>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === f.id
                  ? "bg-brand-700 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1"
            />
          </label>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        {items.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Nothing matches these filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((m) => {
              const label = MOVEMENT_LABEL[m.type] ?? m.type;
              const isCredit = m.amount > 0;
              const isZero = Math.abs(m.amount) < 0.005;
              return (
                <div key={m.id} className="px-4 sm:px-6 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!isZero && (
                      <p
                        className={`font-mono text-sm font-bold ${
                          isCredit ? "text-brand-700" : "text-gray-700"
                        }`}
                      >
                        {isCredit ? "+" : ""}
                        {formatNaira(m.amount)}
                      </p>
                    )}
                  </div>
                  {m.note && (
                    <p className="mt-1 text-xs text-gray-500 leading-snug">{m.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center">
        {hasMore && (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
