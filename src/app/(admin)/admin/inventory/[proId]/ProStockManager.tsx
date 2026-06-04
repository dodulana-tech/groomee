"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface StockRow {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  category: string;
  unit: string;
  unitCost: number;
  qtyOnHand: number;
  lowStockThreshold: number;
  isLow: boolean;
  lastRestockedAt: string | null;
  lastDecrementAt: string | null;
}

interface ProductOpt {
  id: string;
  name: string;
  slug: string;
  unit: string;
  category: string;
}

export default function ProStockManager({
  proId,
  initialStock,
  products,
}: {
  proId: string;
  initialStock: StockRow[];
  products: ProductOpt[];
}) {
  const router = useRouter();
  const [stock, setStock] = useState<StockRow[]>(initialStock);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch(`/api/admin/inventory/${proId}`);
    const data = await res.json();
    if (res.ok) {
      setStock(
        (data.data.stock ?? []).map((s: any) => ({
          ...s,
          lastRestockedAt: s.lastRestockedAt ?? null,
          lastDecrementAt: s.lastDecrementAt ?? null,
        })),
      );
    }
    router.refresh();
  }

  async function restock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inventory/${proId}/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          qty: Number(qty),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQty("5");
      setNote("");
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setThreshold(row: StockRow, t: number) {
    const res = await fetch(`/api/admin/inventory/${proId}/threshold`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: row.productId, threshold: t }),
    });
    if (res.ok) await refresh();
  }

  async function adjust(row: StockRow) {
    const value = prompt(
      `Set absolute stock value for ${row.productName} (currently ${row.qtyOnHand}):`,
      String(row.qtyOnHand),
    );
    if (value == null) return;
    const newQty = Number(value);
    if (!Number.isFinite(newQty) || newQty < 0) {
      alert("Invalid value");
      return;
    }
    const reason = confirm("Was this a correction (OK) or a waste / loss (Cancel)?")
      ? "CORRECTION"
      : "WASTE";
    const res = await fetch(`/api/admin/inventory/${proId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: row.productId, newQty, reason }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 mb-3">Restock</h2>
        <form
          onSubmit={restock}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
              Qty
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
              Note
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="optional"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !productId}
            className="py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: busy ? "#9CA3AF" : "#1A3A2A" }}
          >
            {busy ? "Saving…" : "+ Restock"}
          </button>
        </form>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 mb-3">Current stock</h2>
        {stock.length === 0 ? (
          <p className="text-sm text-gray-400">No stock tracked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2">Product</th>
                <th className="py-2">On hand</th>
                <th className="py-2">Threshold</th>
                <th className="py-2">Last restock</th>
                <th className="py-2">Last decrement</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stock.map((s) => (
                <tr key={s.id} className={s.isLow ? "bg-red-50/40" : ""}>
                  <td className="py-2">
                    <p className="font-medium text-gray-800">{s.productName}</p>
                    <p className="text-xs text-gray-400">{s.category}</p>
                  </td>
                  <td className="py-2">
                    <span
                      className="font-bold"
                      style={{ color: s.isLow ? "#991B1B" : "#1A3A2A" }}
                    >
                      {s.qtyOnHand} {s.unit}
                    </span>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={s.lowStockThreshold}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 0 && v !== s.lowStockThreshold) {
                          setThreshold(s, v);
                        }
                      }}
                      className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm"
                    />
                  </td>
                  <td className="py-2 text-xs text-gray-500">
                    {s.lastRestockedAt
                      ? format(new Date(s.lastRestockedAt), "dd MMM HH:mm")
                      : "—"}
                  </td>
                  <td className="py-2 text-xs text-gray-500">
                    {s.lastDecrementAt
                      ? format(new Date(s.lastDecrementAt), "dd MMM HH:mm")
                      : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => adjust(s)}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Adjust
                    </button>
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
