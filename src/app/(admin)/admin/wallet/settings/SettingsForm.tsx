"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Props {
  initial: {
    mobilization: number;
    completion: number;
    confirm: number;
    defaultCreditLimit: number;
    advanceRepayRate: number;
  };
  canManage: boolean;
}

const PREVIEW_AMOUNT = 15000;

export default function SettingsForm({ initial, canManage }: Props) {
  const router = useRouter();
  const [mob, setMob] = useState(initial.mobilization.toString());
  const [comp, setComp] = useState(initial.completion.toString());
  const [conf, setConf] = useState(initial.confirm.toString());
  const [limit, setLimit] = useState(initial.defaultCreditLimit.toString());
  const [repay, setRepay] = useState(initial.advanceRepayRate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const m = Number(mob);
  const c = Number(comp);
  const f = Number(conf);
  const sum = (Number.isFinite(m) ? m : 0) + (Number.isFinite(c) ? c : 0) + (Number.isFinite(f) ? f : 0);
  const validSum = Math.abs(sum - 1) <= 0.001;

  const previewMob = Number.isFinite(m) ? Math.round(PREVIEW_AMOUNT * m * 100) / 100 : 0;
  const previewComp = Number.isFinite(c) ? Math.round(PREVIEW_AMOUNT * c * 100) / 100 : 0;
  const previewConf = Math.round((PREVIEW_AMOUNT - previewMob - previewComp) * 100) / 100;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!validSum) {
      setError(`Fractions must sum to 1.0 (currently ${sum.toFixed(4)})`);
      return;
    }
    const limitNum = Number(limit);
    if (!Number.isFinite(limitNum) || limitNum < 0) {
      setError("Default credit limit must be a non-negative number.");
      return;
    }
    if (!Number.isFinite(repay) || repay < 0 || repay > 1) {
      setError("Advance repay rate must be between 0 and 1.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/wallet/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobilization: m,
          completion: c,
          confirm: f,
          defaultCreditLimit: limitNum,
          advanceRepayRate: repay,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <fieldset disabled={!canManage}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              className="block text-xs font-semibold text-gray-700"
              htmlFor="mobilization"
            >
              Mobilization (at ACCEPTED)
            </label>
            <input
              id="mobilization"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={mob}
              onChange={(e) => setMob(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Fraction of pro earning released at accept time.
            </p>
          </div>
          <div>
            <label
              className="block text-xs font-semibold text-gray-700"
              htmlFor="completion"
            >
              Completion (at COMPLETED)
            </label>
            <input
              id="completion"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={comp}
              onChange={(e) => setComp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Released when pro marks job done.
            </p>
          </div>
          <div>
            <label
              className="block text-xs font-semibold text-gray-700"
              htmlFor="confirm"
            >
              Confirm (at CONFIRMED)
            </label>
            <input
              id="confirm"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Final slice when customer confirms.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label
            className="block text-xs font-semibold text-gray-700"
            htmlFor="creditLimit"
          >
            Default credit limit (NGN)
          </label>
          <input
            id="creditLimit"
            type="number"
            min="0"
            step="100"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:max-w-xs"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            Maximum negative balance a new pro wallet can carry (clawbacks can briefly push them red).
          </p>
        </div>

        <div className="mt-4">
          <label
            className="block text-xs font-semibold text-gray-700"
            htmlFor="repayRate"
          >
            Advance repayment rate
            <span className="ml-2 text-[11px] font-mono text-gray-500">
              {(repay * 100).toFixed(0)}% of each payout
            </span>
          </label>
          <input
            id="repayRate"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={repay}
            onChange={(e) => setRepay(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            When a pro owes a net advance, up to this fraction of their weekly
            payout is auto-deducted as ADVANCE_REPAYMENT before the bank
            transfer.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Preview · {formatNaira(PREVIEW_AMOUNT)} pro earning
          </p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="font-bold text-gray-900">{formatNaira(previewMob)}</p>
              <p className="text-[11px] text-gray-500">at ACCEPTED</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">{formatNaira(previewComp)}</p>
              <p className="text-[11px] text-gray-500">at COMPLETED</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">{formatNaira(previewConf)}</p>
              <p className="text-[11px] text-gray-500">at CONFIRMED</p>
            </div>
          </div>
          <p
            className={`mt-2 text-[11px] font-semibold ${
              validSum ? "text-emerald-700" : "text-red-600"
            }`}
          >
            Sum: {sum.toFixed(4)} {validSum ? "✓" : "(must equal 1.0)"}
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Saved. New bookings will use these fractions.
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={saving || !validSum || !canManage}
            className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
        {!canManage && (
          <p className="mt-3 text-[11px] text-gray-400">
            Read-only view — you need <code>wallet.manage</code> to edit.
          </p>
        )}
      </fieldset>
    </form>
  );
}
