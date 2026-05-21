"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

export default function AdjustmentForm({ proId, proName }: { proId: string; proName: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const abs = Number(amount);
    if (!Number.isFinite(abs) || abs <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!note.trim()) {
      setError("A note is required.");
      return;
    }
    const signed = direction === "credit" ? abs : -abs;
    if (
      !confirm(
        `Post ${direction === "credit" ? "+" : "-"}${formatNaira(abs)} to ${proName}'s wallet?\n\nThis will be audit-logged and the pro will receive a WhatsApp notification.`,
      )
    )
      return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/wallet/${proId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: signed, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Adjustment failed.");
        return;
      }
      setAmount("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError("Network error. Try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-base font-bold text-gray-900">Manual adjustment</h2>
      <p className="mt-1 text-xs text-gray-500">
        Use sparingly. Every adjustment is audit-logged and the pro is notified
        via WhatsApp.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-700">
            Direction
          </label>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setDirection("credit")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                direction === "credit"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              + Credit
            </button>
            <button
              type="button"
              onClick={() => setDirection("debit")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                direction === "debit"
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              - Debit
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700" htmlFor="amount">
            Amount (NGN)
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="5000"
            required
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-semibold text-gray-700" htmlFor="note">
          Note (required)
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Reason for adjustment (visible to the pro)…"
          required
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting
            ? "Posting…"
            : `Post ${direction === "credit" ? "+" : "-"}${amount ? formatNaira(Number(amount) || 0) : "adjustment"}`}
        </button>
      </div>
    </form>
  );
}
