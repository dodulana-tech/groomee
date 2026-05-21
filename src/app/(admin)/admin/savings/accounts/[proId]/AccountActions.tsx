"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Props {
  proId: string;
  proName: string;
  optedIn: boolean;
  currentRate: number;
  sliderMin: number;
  sliderMax: number;
  goalLabels: string[];
  balanceAvailable: number;
}

export default function AccountActions({
  proId,
  proName,
  optedIn,
  currentRate,
  sliderMin,
  sliderMax,
  goalLabels,
  balanceAvailable,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(currentRate);
  const [goals, setGoals] = useState(goalLabels.join(", "));
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Request failed");
        return null;
      }
      router.refresh();
      return json.data;
    } finally {
      setBusy(false);
    }
  }

  const aboveWarning = rate > 0.10;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Opt-in / opt-out */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Enrollment</h3>
        <p className="text-xs text-gray-500 mb-3">
          {optedIn
            ? `${proName} is enrolled at ${(currentRate * 100).toFixed(1)}%. Skim runs on every confirmed booking.`
            : "Not enrolled. No skim runs."}
        </p>
        <div className="flex gap-2">
          {optedIn ? (
            <button
              disabled={busy}
              onClick={async () => {
                const note = prompt("Reason for opting out (optional):") ?? "";
                await call(`/api/admin/savings/accounts/${proId}/opt-out`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ note }),
                });
              }}
              className="rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
            >
              Opt out
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                await call(`/api/admin/savings/accounts/${proId}/opt-in`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rate }),
                });
              }}
              className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Opt in at {(rate * 100).toFixed(1)}%
            </button>
          )}
        </div>
      </div>

      {/* Skim rate */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Skim rate</h3>
        <p className="text-xs text-gray-500 mb-2">Configurable {(sliderMin * 100).toFixed(0)}–{(sliderMax * 100).toFixed(0)}% of pro earning.</p>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={0.005}
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          className="w-full accent-brand-600"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-bold text-gray-900">{(rate * 100).toFixed(1)}%</span>
          <button
            disabled={busy || rate === currentRate}
            onClick={async () => {
              await call(`/api/admin/savings/accounts/${proId}/rate`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rate }),
              });
            }}
            className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Update rate
          </button>
        </div>
        {aboveWarning && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
            ⚠️ Above 10% — confirm this matches what {proName} requested. Forced savings stack quickly.
          </p>
        )}
      </div>

      {/* Goal labels */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Goal labels</h3>
        <p className="text-xs text-gray-500 mb-2">Comma-separated (Rent, School, Tools…). Up to 12.</p>
        <input
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="Rent, School, Tools"
        />
        <button
          disabled={busy}
          onClick={async () => {
            const arr = goals.split(",").map((s) => s.trim()).filter(Boolean);
            await call(`/api/admin/savings/accounts/${proId}/goals`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ goals: arr }),
            });
          }}
          className="mt-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Save goals
        </button>
      </div>

      {/* Manual adjustment */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Manual adjustment</h3>
        <p className="text-xs text-gray-500 mb-2">
          Audit-logged. Positive credits, negative debits. Affects available balance.
        </p>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.01"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="Amount (₦)"
            className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Reason (min 5 chars)"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={busy || !adjustAmount || adjustNote.trim().length < 5}
          onClick={async () => {
            const amount = parseFloat(adjustAmount);
            if (!Number.isFinite(amount) || amount === 0) {
              setError("Amount must be non-zero");
              return;
            }
            await call(`/api/admin/savings/accounts/${proId}/adjust`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount, note: adjustNote.trim() }),
            });
            setAdjustAmount("");
            setAdjustNote("");
          }}
          className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          Apply adjustment
        </button>
      </div>

      {/* Match bonus */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Loyalty top-up (match bonus)</h3>
        <p className="text-xs text-gray-500 mb-2">
          Credits the pro&apos;s available Reserve balance and fires a celebratory WhatsApp.
          Audit-logged. Paid from take-rate, not interest.
        </p>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.01"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
            placeholder="Amount (₦)"
            className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={bonusNote}
            onChange={(e) => setBonusNote(e.target.value)}
            placeholder="Reason (min 5 chars)"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={busy || !bonusAmount || bonusNote.trim().length < 5}
          onClick={async () => {
            const amount = parseFloat(bonusAmount);
            if (!Number.isFinite(amount) || amount <= 0) {
              setError("Amount must be positive");
              return;
            }
            await call(`/api/admin/savings/accounts/${proId}/match-bonus`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount, note: bonusNote.trim() }),
            });
            setBonusAmount("");
            setBonusNote("");
          }}
          className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Award match bonus
        </button>
      </div>

      {/* Verify balances */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Verify balances</h3>
        <p className="text-xs text-gray-500 mb-2">
          Sums every SavingsMovement and resets cached totals. Shows drift if any.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            const data = await call(`/api/admin/savings/accounts/${proId}/verify-balances`, {
              method: "POST",
            });
            if (data) setVerifyResult(data);
          }}
          className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Run forensic recompute
        </button>
        {verifyResult ? (
          <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-2 overflow-auto max-h-48">
            {JSON.stringify(verifyResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="glass-card rounded-2xl p-4 bg-gray-50 text-xs text-gray-500">
        Available for withdrawal: <strong className="text-gray-900">{formatNaira(balanceAvailable)}</strong>
      </div>
    </div>
  );
}
