"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/utils";

interface Props {
  proId: string;
  currentTypeFilter: string;
}

interface RecomputeResult {
  cached: number;
  ledgerSum: number;
  drift: number;
  ok: boolean;
}

// Recompute + Export buttons for the per-pro wallet detail page.
//
// Recompute is forensic-only — it never auto-heals drift. Admin must post a
// MANUAL_ADJUSTMENT if they want to reconcile.
export default function WalletTools({ proId, currentTypeFilter }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecomputeResult | null>(null);
  const [error, setError] = useState("");

  async function runRecompute() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/admin/wallet/${proId}/recompute`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Recompute failed");
        return;
      }
      setResult(data.data as RecomputeResult);
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const qs = currentTypeFilter ? `?type=${encodeURIComponent(currentTypeFilter)}` : "";
    window.location.href = `/api/admin/wallet/${proId}/ledger.csv${qs}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={runRecompute}
        disabled={busy}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "Recompute balance"}
      </button>
      <button
        onClick={exportCsv}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        Export ledger CSV
      </button>

      {error && (
        <p className="ml-1 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}
      {result && (
        <div
          className={`ml-1 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
            result.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {result.ok ? (
            <>
              Cached balance matches ledger: {formatNaira(result.cached)}
            </>
          ) : (
            <>
              Drift detected · Cached {formatNaira(result.cached)} ·
              Ledger sum {formatNaira(result.ledgerSum)} · Δ{" "}
              <span className="font-bold">{formatNaira(result.drift)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
