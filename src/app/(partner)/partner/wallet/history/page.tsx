"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatNaira, cn } from "@/lib/utils";
import {
  MOVEMENT_LABEL,
  MOVEMENT_BADGE,
  TYPE_GROUPS,
  TYPE_GROUP_LABEL,
  type WalletTypeGroup,
} from "@/lib/wallet-labels";
import type { WalletMovementType } from "@prisma/client";

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

interface LedgerResponse {
  rows: LedgerRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

const GROUPS = Object.keys(TYPE_GROUPS) as WalletTypeGroup[];

// useSearchParams needs a Suspense boundary or the production build fails
// trying to prerender this page.
export default function WalletHistoryPage() {
  return (
    <Suspense>
      <WalletHistory />
    </Suspense>
  );
}

function WalletHistory() {
  const router = useRouter();
  const search = useSearchParams();
  const group = ((search.get("group") ?? "all") as WalletTypeGroup);
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";

  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [olderCursors, setOlderCursors] = useState<string[]>([]);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);

  function buildQS(opts: { group?: WalletTypeGroup; from?: string; to?: string; cursor?: string | null }) {
    const params = new URLSearchParams();
    const g = opts.group ?? group;
    const f = opts.from ?? from;
    const t = opts.to ?? to;
    if (g && g !== "all") params.set("typeGroup", g);
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    if (opts.cursor) params.set("cursor", opts.cursor);
    params.set("limit", "50");
    return params.toString();
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/partner/wallet/ledger?${buildQS({ cursor: activeCursor })}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setError(j.error ?? "Failed to load");
      })
      .catch(() => setError("Could not load history."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, from, to, activeCursor]);

  function setGroup(g: WalletTypeGroup) {
    setActiveCursor(null);
    setOlderCursors([]);
    const params = new URLSearchParams(search.toString());
    if (g === "all") params.delete("group");
    else params.set("group", g);
    router.push(`/partner/wallet/history?${params.toString()}`);
  }

  function setDates(nextFrom: string, nextTo: string) {
    setActiveCursor(null);
    setOlderCursors([]);
    const params = new URLSearchParams(search.toString());
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    router.push(`/partner/wallet/history?${params.toString()}`);
  }

  function goNext() {
    if (!data?.nextCursor) return;
    setOlderCursors((s) => [...s, activeCursor ?? ""]);
    // nextCursor is an ISO string after JSON deserialization.
    setActiveCursor(String(data.nextCursor));
  }
  function goPrev() {
    const next = [...olderCursors];
    const last = next.pop();
    setOlderCursors(next);
    setActiveCursor(last ? last : null);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <Link
          href="/partner/wallet"
          className="text-xs font-semibold text-brand-700 hover:underline"
          style={{ color: "#014342" }}
        >
          ← Wallet
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Wallet history</h1>
        <p className="text-sm text-gray-500">
          Every wallet movement on your account.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              group === g
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50",
            )}
          >
            {TYPE_GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-gray-500">
          From
          <input
            type="date"
            defaultValue={from}
            onBlur={(e) => setDates(e.target.value, to)}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-500">
          To
          <input
            type="date"
            defaultValue={to}
            onBlur={(e) => setDates(from, e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {(from || to) && (
          <button
            onClick={() => setDates("", "")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Clear dates
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400 px-5">
            <p className="text-3xl mb-2">📜</p>
            <p className="font-semibold text-gray-600">No movements found.</p>
            <p className="text-sm mt-1">Try a different filter or date range.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.rows.map((r) => {
              const positive = r.amount >= 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
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
                        <span className="text-[10px] font-semibold text-gray-400">
                          {r.bookingRef}
                        </span>
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
                        year: "numeric",
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
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={olderCursors.length === 0}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200",
            olderCursors.length === 0
              ? "text-gray-300 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          ← Newer
        </button>
        <button
          onClick={goNext}
          disabled={!data?.hasMore}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200",
            !data?.hasMore
              ? "text-gray-300 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          Older →
        </button>
      </div>
    </div>
  );
}
