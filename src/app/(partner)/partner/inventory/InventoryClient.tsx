"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

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

interface LowItem {
  productId: string;
  productName: string;
  unit: string;
  qtyOnHand: number;
  threshold: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  unit: string;
  unitCost: number;
  photo: string | null;
  alreadyTracked: boolean;
}

type Modal =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "restock"; row: StockRow }
  | { kind: "waste"; row: StockRow };

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  HAIR_CARE: "Hair care",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  LASHES: "Lashes",
  SKINCARE: "Skincare",
  TOOLS: "Tools",
  CONSUMABLE: "Consumable",
  OTHER: "Other",
};

export default function InventoryClient({
  initialStock,
  initialLow,
  catalog,
  lastRestockedAt,
}: {
  initialStock: StockRow[];
  initialLow: LowItem[];
  catalog: CatalogProduct[];
  lastRestockedAt: string | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  function close() {
    setModal({ kind: "none" });
  }

  async function refresh() {
    router.refresh();
  }

  async function patchThreshold(row: StockRow, newThreshold: number) {
    if (newThreshold < 0 || newThreshold > 1000) {
      showToast("Threshold must be between 0 and 1000.");
      return;
    }
    if (newThreshold === row.lowStockThreshold) return;
    setBusyKey(`t-${row.productId}`);
    try {
      const res = await fetch("/api/partner/inventory/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: row.productId, threshold: newThreshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      showToast("Threshold updated.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyKey(null);
    }
  }

  const lowCount = initialLow.length;

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Products tracked
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {initialStock.length}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Low stock
          </p>
          <p
            className={`mt-1 text-3xl font-black ${
              lowCount > 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {lowCount}
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Last restock
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatRelative(lastRestockedAt)}
          </p>
        </div>
      </div>

      {/* Low-stock callout */}
      {initialLow.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/70 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-red-800 flex items-center gap-2">
              <span>⚠️</span>
              Low stock — restock soon
            </h2>
            <span className="text-xs font-bold text-red-700">
              {initialLow.length} item{initialLow.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-2">
            {initialLow.map((l) => {
              const row = initialStock.find((s) => s.productId === l.productId);
              return (
                <li
                  key={l.productId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/partner/inventory/${l.productId}`}
                      className="font-semibold text-gray-900 hover:text-green-700 truncate block"
                    >
                      {l.productName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-red-700">
                        {l.qtyOnHand} {l.unit}
                      </span>
                      <span className="text-gray-400"> · threshold {l.threshold}</span>
                    </p>
                  </div>
                  {row && (
                    <button
                      onClick={() => setModal({ kind: "restock", row })}
                      className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition shrink-0"
                    >
                      Restock
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Stock table */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Your supplies</h2>
          <button
            onClick={() => setModal({ kind: "add" })}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 transition self-start sm:self-auto"
          >
            + Add product
          </button>
        </div>

        {initialStock.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              You haven&apos;t tracked any products
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              Add what you keep on hand to get auto-decrement on every booking
              and low-stock alerts.
            </p>
            <button
              onClick={() => setModal({ kind: "add" })}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition"
            >
              Start tracking →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-white/40">
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-4 py-2 font-semibold">On hand</th>
                  <th className="px-4 py-2 font-semibold">Threshold</th>
                  <th className="px-4 py-2 font-semibold">Last restock</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {initialStock.map((s) => (
                  <tr key={s.id} className={s.isLow ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/partner/inventory/${s.productId}`}
                        className="font-medium text-gray-900 hover:text-green-700"
                      >
                        {s.productName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {formatNaira(s.unitCost)} per {s.unit}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-bold ${
                          s.isLow ? "text-red-700" : "text-gray-900"
                        }`}
                      >
                        {s.qtyOnHand} {s.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="1"
                        defaultValue={s.lowStockThreshold}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v)) patchThreshold(s, v);
                        }}
                        disabled={busyKey === `t-${s.productId}`}
                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatRelative(s.lastRestockedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setModal({ kind: "restock", row: s })}
                          className="rounded-lg bg-green-600/10 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-600/20 transition"
                        >
                          Restock
                        </button>
                        <button
                          onClick={() => setModal({ kind: "waste", row: s })}
                          className="rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-600/20 transition"
                          disabled={s.qtyOnHand <= 0}
                          title={s.qtyOnHand <= 0 ? "Nothing to log" : ""}
                        >
                          Log waste
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.kind === "restock" && (
        <RestockModal
          row={modal.row}
          onClose={close}
          onSuccess={(msg) => {
            close();
            showToast(msg);
            refresh();
          }}
        />
      )}
      {modal.kind === "waste" && (
        <WasteModal
          row={modal.row}
          onClose={close}
          onSuccess={(msg) => {
            close();
            showToast(msg);
            refresh();
          }}
        />
      )}
      {modal.kind === "add" && (
        <AddProductModal
          catalog={catalog}
          onClose={close}
          onSuccess={(msg) => {
            close();
            showToast(msg);
            refresh();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gray-900 text-white text-sm px-5 py-2.5 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}

// ─── MODALS ───────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function RestockModal({
  row,
  onClose,
  onSuccess,
}: {
  row: StockRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a quantity above zero.");
      return;
    }
    if (n > 10_000) {
      setError("That looks too high — max 10,000 per restock.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/inventory/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          qty: n,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess(`Added ${n} ${row.unit} of ${row.productName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restock");
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Restock ${row.productName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Currently on hand: <strong>{row.qtyOnHand} {row.unit}</strong>
        </p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Quantity to add ({row.unit})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            max="10000"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Note (optional)
          </label>
          <input
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. bought at Balogun market"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">{note.length}/120</p>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {busy ? "Saving…" : "Confirm restock"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function WasteModal({
  row,
  onClose,
  onSuccess,
}: {
  row: StockRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a quantity above zero.");
      return;
    }
    if (n > row.qtyOnHand) {
      setError(
        `You only have ${row.qtyOnHand} ${row.unit} on hand. Restock first or contact support.`,
      );
      return;
    }
    if (note.trim().length < 5) {
      setError("Tell us what happened (at least 5 characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/inventory/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          qty: n,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess(`Logged ${n} ${row.unit} waste on ${row.productName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log waste");
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Log waste · ${row.productName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Currently on hand: <strong>{row.qtyOnHand} {row.unit}</strong>
        </p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Quantity wasted ({row.unit})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            max={row.qtyOnHand}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-red-500 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            What happened? (required)
          </label>
          <textarea
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. spilled while travelling, bottle broke"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-red-500 focus:outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            {note.length}/120 · 5 chars min
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:bg-gray-400"
          >
            {busy ? "Saving…" : "Log waste"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AddProductModal({
  catalog,
  onClose,
  onSuccess,
}: {
  catalog: CatalogProduct[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState("0");
  const [threshold, setThreshold] = useState("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => catalog.filter((c) => !c.alreadyTracked),
    [catalog],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? available.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (CATEGORY_LABELS[p.category] ?? p.category)
              .toLowerCase()
              .includes(q),
        )
      : available;
    return base.slice(0, 30);
  }, [available, query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) {
      setError("Pick a product to track.");
      return;
    }
    const q = Number(qty);
    const t = Number(threshold);
    if (!Number.isFinite(q) || q < 0 || q > 10_000) {
      setError("Quantity must be between 0 and 10,000.");
      return;
    }
    if (!Number.isFinite(t) || t < 0 || t > 1000) {
      setError("Threshold must be between 0 and 1000.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/inventory/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: picked.id,
          qty: q,
          threshold: t,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess(`Tracking ${picked.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add a product to track" onClose={onClose}>
      {!picked ? (
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foundation, gel polish, relaxer…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
            autoFocus
          />
          {available.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              You&apos;re already tracking every product in the catalog. Nice.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No matches. Try a different word.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(p)}
                    className="w-full text-left flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[p.category] ?? p.category} · per {p.unit}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatNaira(p.unitCost)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{picked.name}</p>
              <p className="text-xs text-gray-500">
                {CATEGORY_LABELS[picked.category] ?? picked.category} · per{" "}
                {picked.unit}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs font-bold text-green-700 hover:underline"
            >
              Change
            </button>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
              Starting quantity ({picked.unit})
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              max="10000"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              How much do you have on hand right now? 0 is fine — you can
              restock later.
            </p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
              Low-stock threshold
            </label>
            <input
              type="number"
              min="0"
              step="1"
              max="1000"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              We&apos;ll alert you when stock drops below this number. Set to 0
              to mute alerts.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {busy ? "Saving…" : "Start tracking"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
