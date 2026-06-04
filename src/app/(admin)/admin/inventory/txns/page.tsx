"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface Txn {
  id: string;
  proId: string;
  productId: string;
  delta: number;
  qtyAfter: number;
  reason: string;
  bookingId: string | null;
  note: string | null;
  createdAt: string;
  product: { id: string; name: string; unit: string } | null;
  pro: { id: string; name: string; phone: string } | null;
}

const REASONS = [
  "INITIAL_STOCK",
  "RESTOCK",
  "BOOKING_DECREMENT",
  "ADMIN_ADJUSTMENT",
  "WASTE",
  "CORRECTION",
];

export default function InventoryTxnsPage() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [proId, setProId] = useState("");
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (reason) params.set("reason", reason);
    if (proId) params.set("proId", proId);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("take", "100");
    return fetch(`/api/admin/inventory/txns?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    const params = new URLSearchParams();
    if (reason) params.set("reason", reason);
    if (proId) params.set("proId", proId);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("format", "csv");
    window.location.href = `/api/admin/inventory/txns?${params}`;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/inventory"
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            ← Inventory
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Transaction log
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} matching transactions.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          Export CSV
        </button>
      </div>

      <div className="glass-card rounded-2xl p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          >
            <option value="">All reasons</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            value={proId}
            onChange={(e) => setProId(e.target.value)}
            placeholder="Pro ID"
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="Product ID"
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#1A3A2A" }}
          >
            Apply filters
          </button>
          <button
            onClick={() => {
              setReason("");
              setProId("");
              setProductId("");
              setFrom("");
              setTo("");
              setTimeout(load, 0);
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
              style={{ borderTopColor: "#1A3A2A" }}
            />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2">When</th>
                <th className="py-2">Pro</th>
                <th className="py-2">Product</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Δ</th>
                <th className="py-2">After</th>
                <th className="py-2">Booking</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 text-xs text-gray-500">
                    {format(new Date(t.createdAt), "dd MMM HH:mm")}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/inventory/${t.proId}`}
                      className="text-gray-800 hover:underline"
                    >
                      {t.pro?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-700">
                    {t.product?.name ?? "—"}
                  </td>
                  <td className="py-2 text-xs text-gray-500">{t.reason}</td>
                  <td
                    className="py-2 font-bold"
                    style={{ color: t.delta < 0 ? "#991B1B" : "#166534" }}
                  >
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </td>
                  <td className="py-2 text-gray-600">{t.qtyAfter}</td>
                  <td className="py-2 text-xs text-gray-500">
                    {t.bookingId ? (
                      <Link
                        href={`/admin/bookings/${t.bookingId}`}
                        className="font-mono hover:underline"
                      >
                        {t.bookingId.slice(0, 8)}…
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 text-xs text-gray-500 truncate max-w-[200px]">
                    {t.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
