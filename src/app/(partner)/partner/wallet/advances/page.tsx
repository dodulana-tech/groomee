"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira, cn } from "@/lib/utils";

interface Advance {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface Eligibility {
  eligible: boolean;
  hasOpen: boolean;
  meetsJobs: boolean;
  meetsRating: boolean;
  minJobs: number;
  minRating: number;
  maxAmount: number;
  totalJobs: number;
  avgRating: number;
}

interface AdvancesData {
  advances: Advance[];
  eligibility: Eligibility;
  netAdvanceOwed: number;
  repayRate: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-700",
  DISBURSED: "bg-emerald-100 text-emerald-700",
  REPAID: "bg-gray-200 text-gray-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Under review",
  APPROVED: "Approved — awaiting payout",
  DISBURSED: "Cash sent",
  REPAID: "Fully repaid",
  REJECTED: "Not approved",
};

export default function PartnerAdvancesPage() {
  const [data, setData] = useState<AdvancesData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function load() {
    setLoadError("");
    fetch("/api/partner/wallet/advances")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setLoadError(j.error ?? "Failed to load");
      })
      .catch(() => setLoadError("Could not load advances."));
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setSubmitOk(false);
    try {
      const res = await fetch("/api/pro/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseInt(amount, 10),
          reason: reason.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setSubmitError(j.error ?? "Could not submit request.");
      } else {
        setSubmitOk(true);
        setAmount("");
        setReason("");
        load();
      }
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div className="p-8 space-y-6">
        {loadError ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">{loadError}</p>
            <button onClick={load} className="btn-primary btn-sm">Retry</button>
          </div>
        ) : (
          <div className="skeleton h-8 w-48" />
        )}
      </div>
    );
  }

  const elig = data.eligibility;
  const repayPct = Math.round(data.repayRate * 100);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div>
        <Link
          href="/partner/wallet"
          className="text-xs font-semibold"
          style={{ color: "#014342" }}
        >
          ← Wallet
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Advances</h1>
        <p className="text-sm text-gray-500">
          Borrow against your future earnings when life happens.
        </p>
      </div>

      {/* Eligibility card */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-gray-900">Your eligibility</h2>
            {elig.eligible ? (
              <p className="mt-1 text-sm text-emerald-700">
                ✓ You can request up to {formatNaira(elig.maxAmount)}.
              </p>
            ) : elig.hasOpen ? (
              <p className="mt-1 text-sm text-amber-700">
                You already have an open advance. Repay it fully before
                requesting another.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                Build your track record to unlock advances.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Jobs done
              </p>
              <p
                className={cn(
                  "mt-0.5 font-bold",
                  elig.meetsJobs ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {elig.totalJobs} / {elig.minJobs}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Rating
              </p>
              <p
                className={cn(
                  "mt-0.5 font-bold",
                  elig.meetsRating ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {elig.avgRating.toFixed(1)} / {elig.minRating.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Net owed */}
      {data.netAdvanceOwed > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
            You currently owe
          </p>
          <p className="mt-1 text-2xl font-black text-amber-900">
            {formatNaira(data.netAdvanceOwed)}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            {repayPct}% of each weekly payout goes here until it&apos;s cleared.
          </p>
        </div>
      )}

      {/* Request form */}
      {elig.eligible && (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4"
        >
          <h2 className="font-bold text-gray-900">Request an advance</h2>
          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          {submitOk && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
              Request submitted. We&apos;ll review and let you know shortly.
            </div>
          )}
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Amount (₦)
            </span>
            <input
              type="number"
              min={5000}
              max={elig.maxAmount}
              step={500}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 15000"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base"
            />
            <span className="text-[11px] text-gray-400">
              Min ₦5,000 · Max {formatNaira(elig.maxAmount)}
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              What&apos;s it for?
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Family emergency, equipment, transport, etc."
              minLength={10}
              maxLength={500}
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base"
              rows={3}
            />
            <span className="text-[11px] text-gray-400">
              At least 10 characters. Be honest — it helps us approve faster.
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: "#c8871a" }}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}

      {/* How repayment works */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="font-bold text-gray-900">How repayment works</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            • When approved, the cash hits your bank or wallet on disbursement.
          </li>
          <li>
            • <strong>{repayPct}%</strong> of each weekly payout is automatically
            deducted to clear the balance.
          </li>
          <li>
            • No interest, no late fees — just steady, predictable recoupment.
          </li>
          <li>
            • You can&apos;t take a second advance while one is still outstanding.
          </li>
        </ul>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Your advances</h2>
        </div>
        {data.advances.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            You haven&apos;t taken any advances yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.advances.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-600",
                      )}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {a.reason}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(a.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="font-mono text-sm font-bold text-gray-900 shrink-0">
                  {formatNaira(a.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
