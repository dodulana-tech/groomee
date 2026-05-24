"use client";

import { useState } from "react";
import Link from "next/link";

interface Txn {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  unit: string;
  delta: number;
  qtyAfter: number;
  reason: string;
  bookingId: string | null;
  note: string | null;
}

const REASON_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "RESTOCK", label: "Restock" },
  { value: "INITIAL_STOCK", label: "Initial" },
  { value: "BOOKING_DECREMENT", label: "Bookings" },
  { value: "WASTE", label: "Waste" },
  { value: "ADMIN_ADJUSTMENT", label: "Admin" },
  { value: "CORRECTION", label: "Correction" },
];

const REASON_LABELS: Record<string, string> = {
  RESTOCK: "Restock",
  INITIAL_STOCK: "Initial stock",
  BOOKING_DECREMENT: "Used on booking",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  WASTE: "Waste",
  CORRECTION: "Correction",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryClient({
  initialItems,
  initialNextCursor,
}: {
  initialItems: Txn[];
  initialNextCursor: string | null;
}) {
  const [items, setItems] = useState<Txn[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(opts: { reset?: boolean; reasonFilter?: string }) {
    setBusy(true);
    setError("");
    try {
      const url = new URL("/api/partner/inventory/txns", window.location.origin);
      url.searchParams.set("limit", "50");
      const r = opts.reasonFilter ?? reason;
      if (r) url.searchParams.set("reason", r);
      if (!opts.reset && nextCursor) url.searchParams.set("cursor", nextCursor);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const fetched: Txn[] = data.data.items;
      setItems((prev) => (opts.reset ? fetched : [...prev, ...fetched]));
      setNextCursor(data.data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  function applyFilter(value: string) {
    setReason(value);
    setNextCursor(null);
    load({ reset: true, reasonFilter: value });
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {REASON_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              reason === f.value
                ? "bg-green-600 text-white"
                : "bg-white/70 text-gray-700 hover:bg-white border border-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No transactions match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-white/40">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 font-semibold">Reason</th>
                  <th className="px-4 py-2 font-semibold text-right">Δ</th>
                  <th className="px-4 py-2 font-semibold text-right">After</th>
                  <th className="px-4 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/partner/inventory/${t.productId}`}
                        className="text-gray-800 hover:text-green-700 font-medium"
                      >
                        {t.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {REASON_LABELS[t.reason] ?? t.reason}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-bold text-right ${
                        t.delta < 0 ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {t.delta > 0 ? `+${t.delta}` : t.delta}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {t.qtyAfter}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[240px]">
                      {t.reason === "BOOKING_DECREMENT" && t.bookingId ? (
                        <Link
                          href={`/partner/bookings/${t.bookingId}`}
                          className="font-bold text-green-700 hover:underline"
                        >
                          View booking
                        </Link>
                      ) : (
                        (t.note ?? "—")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="text-center">
        {nextCursor ? (
          <button
            onClick={() => load({ reset: false })}
            disabled={busy}
            className="rounded-xl bg-white/80 border border-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Loading…" : "Load more"}
          </button>
        ) : (
          items.length > 0 && (
            <p className="text-xs text-gray-400">— End of history —</p>
          )
        )}
      </div>
    </>
  );
}
