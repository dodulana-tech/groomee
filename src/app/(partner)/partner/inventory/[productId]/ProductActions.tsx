"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Modal = "none" | "restock" | "waste";

export default function ProductActions({
  productId,
  productName,
  unit,
  qtyOnHand,
}: {
  productId: string;
  productName: string;
  unit: string;
  qtyOnHand: number;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>("none");

  function close() {
    setModal("none");
  }

  function onSuccess() {
    close();
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setModal("restock")}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 transition"
        >
          + Restock
        </button>
        <button
          onClick={() => setModal("waste")}
          disabled={qtyOnHand <= 0}
          className="rounded-xl bg-red-600/10 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Log waste
        </button>
      </div>

      {modal === "restock" && (
        <RestockForm
          productId={productId}
          productName={productName}
          unit={unit}
          qtyOnHand={qtyOnHand}
          onClose={close}
          onSuccess={onSuccess}
        />
      )}
      {modal === "waste" && (
        <WasteForm
          productId={productId}
          productName={productName}
          unit={unit}
          qtyOnHand={qtyOnHand}
          onClose={close}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}

function Shell({
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

function RestockForm({
  productId,
  productName,
  unit,
  qtyOnHand,
  onClose,
  onSuccess,
}: {
  productId: string;
  productName: string;
  unit: string;
  qtyOnHand: number;
  onClose: () => void;
  onSuccess: () => void;
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
      setError("Max 10,000 per restock.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/inventory/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          qty: n,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Shell title={`Restock ${productName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Currently on hand: <strong>{qtyOnHand} {unit}</strong>
        </p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Quantity ({unit})
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
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none"
          />
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
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
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
    </Shell>
  );
}

function WasteForm({
  productId,
  productName,
  unit,
  qtyOnHand,
  onClose,
  onSuccess,
}: {
  productId: string;
  productName: string;
  unit: string;
  qtyOnHand: number;
  onClose: () => void;
  onSuccess: () => void;
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
    if (n > qtyOnHand) {
      setError(`You only have ${qtyOnHand} ${unit} on hand.`);
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
          productId,
          qty: n,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Shell title={`Log waste · ${productName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          On hand: <strong>{qtyOnHand} {unit}</strong>
        </p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Quantity wasted ({unit})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            max={qtyOnHand}
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
            placeholder="e.g. spilled, bottle broke, expired"
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
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
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
    </Shell>
  );
}
