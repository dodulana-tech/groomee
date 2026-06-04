"use client";

// Main Reserve page for the partner portal. Single client component so the
// opt-in vs opted-in branches, modals (withdraw / pause), inline goal editor,
// and rate slider all share local state without a server roundtrip per UI
// micro-interaction. All persistence flows through /api/partner/reserve.
//
// Branding: never "savings" externally. Always "Reserve" / "Earnings Reserve".

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Summary {
  optedIn: boolean;
  optedInAt: string | null;
  optedOutAt: string | null;
  rate: number;
  noticeDays: number;
  instantPenaltyPct: number;
  balanceAvailable: number;
  balanceLocked: number;
  balancePendingWd: number;
  totalBalance: number;
  totalSkimmed: number;
  totalMatchEarned: number;
  totalWithdrawn: number;
  goals: { name: string; sortOrder: number }[];
  openWithdrawals: number;
  config: {
    enabled: boolean;
    defaultRate: number;
    minRate: number;
    maxRate: number;
    noticeDays: number;
    instantPenaltyPct: number;
    matchBonusPct: number;
  };
}

interface Withdrawal {
  id: string;
  amount: number;
  netAmount: number;
  penaltyAmount: number;
  status: "PENDING" | "ELIGIBLE" | "PAID" | "CANCELLED" | "FAILED";
  isInstant: boolean;
  noticeUntil: string | null;
  createdAt: string;
}

interface Movement {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

const MOVEMENT_LABEL: Record<string, string> = {
  SKIM: "Set aside",
  MATCH_BONUS: "Loyalty bonus",
  INTEREST_CREDIT: "Yield",
  WITHDRAWAL_REQUEST: "Withdrawal requested",
  WITHDRAWAL_RELEASED: "Withdrawn to bank",
  WITHDRAWAL_CANCELLED: "Withdrawal cancelled",
  ADJUSTMENT: "Adjustment",
  CLAWBACK: "Reversed",
  EARLY_BREAK_PENALTY: "Instant fee",
};

const SAMPLE_BOOKING = 15000; // ₦15k preview baseline used in opt-in + slider hints

function pct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return "";
  const sign = ms >= 0 ? "in" : "ago";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  if (days > 0) return `${sign === "in" ? "in" : ""} ${days}d ${hours}h ${sign === "ago" ? "ago" : ""}`.trim();
  const mins = Math.floor((abs % 3600000) / 60000);
  if (hours > 0) return `${sign === "in" ? "in" : ""} ${hours}h ${mins}m ${sign === "ago" ? "ago" : ""}`.trim();
  return `${sign === "in" ? "in" : ""} ${mins}m ${sign === "ago" ? "ago" : ""}`.trim();
}

export default function PartnerReservePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Local edit state for the rate slider — keeps the slider responsive without
  // a server roundtrip per drag tick. Synced from summary.rate on load.
  const [draftRate, setDraftRate] = useState<number | null>(null);
  const [rateSaved, setRateSaved] = useState(false);

  // Modals
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [s, w, m] = await Promise.all([
        fetch("/api/partner/reserve/summary").then((r) => r.json()),
        fetch("/api/partner/reserve/withdrawals").then((r) => r.json()),
        fetch("/api/partner/reserve/movements?limit=15").then((r) => r.json()),
      ]);
      if (!s.success) throw new Error(s.error ?? "Failed to load summary");
      setSummary(s.data);
      setDraftRate((prev) => (prev == null ? s.data.rate : prev));
      if (w.success) setWithdrawals(w.data);
      if (m.success) setMovements(m.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Reserve");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function optIn(rate?: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/reserve/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rate != null ? { rate } : {}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on Reserve");
    } finally {
      setBusy(false);
    }
  }

  async function optOut() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/reserve/opt-out", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setShowPause(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pause Reserve");
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(rate: number) {
    setBusy(true);
    setError("");
    setRateSaved(false);
    try {
      const res = await fetch("/api/partner/reserve/rate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 2000);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update rate");
    } finally {
      setBusy(false);
    }
  }

  async function saveGoals(goals: string[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/reserve/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: goals.map((name, idx) => ({ name, sortOrder: idx })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setShowGoals(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save goals");
    } finally {
      setBusy(false);
    }
  }

  async function cancelWithdrawal(id: string) {
    if (!confirm("Cancel this withdrawal? Your money returns to your available Reserve.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/reserve/withdrawals/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        {error ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">{error}</p>
            <button onClick={refresh} className="btn-primary btn-sm">Retry</button>
          </div>
        ) : (
          <>
            <div className="skeleton h-8 w-48" />
            <div className="glass rounded-2xl border border-white/20 p-6">
              <div className="skeleton h-4 w-32 mb-2" />
              <div className="skeleton h-8 w-40" />
            </div>
          </>
        )}
      </div>
    );
  }

  if (!summary.optedIn) {
    return <OptInScreen summary={summary} onOptIn={optIn} busy={busy} error={error} />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings Reserve</h1>
          <p className="text-sm text-gray-500">
            Your money. Held in your name. You control it.
          </p>
        </div>
        <div className="hidden sm:block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
          On
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Balance card */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Available now
        </p>
        <p className="mt-1 text-4xl font-black text-brand-700">
          {formatNaira(summary.balanceAvailable)}
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <BalanceChip label="Locked" amount={summary.balanceLocked} hint="Within reversal window" />
          <BalanceChip label="In withdrawal" amount={summary.balancePendingWd} hint="Already requested" />
          <BalanceChip label="Total saved" amount={summary.totalSkimmed} />
          <BalanceChip label="Bonuses earned" amount={summary.totalMatchEarned} highlight />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={summary.balanceAvailable <= 0 || busy}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white shadow disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Request withdrawal
          </button>
          <Link
            href="/partner/reserve/history"
            className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-bold text-gray-700"
          >
            Activity
          </Link>
          <Link
            href="/partner/reserve/withdrawals"
            className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-bold text-gray-700"
          >
            Withdrawals
          </Link>
        </div>
      </div>

      {/* Rate slider */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">How much you set aside</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Slide between {pct(summary.config.minRate)} and {pct(summary.config.maxRate)} of each booking.
            </p>
          </div>
          <span className="rounded-lg bg-brand-50 px-3 py-1 text-lg font-black text-brand-700">
            {pct(draftRate ?? summary.rate)}
          </span>
        </div>
        <input
          type="range"
          min={Math.round(summary.config.minRate * 100)}
          max={Math.round(summary.config.maxRate * 100)}
          step={1}
          value={Math.round((draftRate ?? summary.rate) * 100)}
          onChange={(e) => setDraftRate(parseInt(e.target.value, 10) / 100)}
          className="mt-4 w-full accent-brand-700"
        />
        <p className="mt-2 text-xs text-gray-500">
          On a ₦{SAMPLE_BOOKING.toLocaleString("en-NG")} booking, ₦
          <strong className="text-gray-900">
            {Math.round(SAMPLE_BOOKING * (draftRate ?? summary.rate)).toLocaleString("en-NG")}
          </strong>{" "}
          goes to your Reserve.
        </p>
        {draftRate != null && Math.abs(draftRate - summary.rate) > 0.0001 && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => saveRate(draftRate)}
              disabled={busy}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white shadow disabled:bg-gray-300"
            >
              Save change
            </button>
            <button
              onClick={() => setDraftRate(summary.rate)}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              Reset
            </button>
          </div>
        )}
        {rateSaved && (
          <p className="mt-2 text-xs font-semibold text-green-700">Saved.</p>
        )}
      </div>

      {/* Goals */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Your goals</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick what you&apos;re saving for. Max 3.
            </p>
          </div>
          <button
            onClick={() => setShowGoals(true)}
            className="text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            {summary.goals.length === 0 ? "Add goals" : "Edit"}
          </button>
        </div>
        {summary.goals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No goals set yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.goals.map((g) => (
              <span
                key={g.name}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pending withdrawals */}
      {withdrawals.filter((w) => ["PENDING", "ELIGIBLE"].includes(w.status)).length > 0 && (
        <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">In progress</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {withdrawals
              .filter((w) => ["PENDING", "ELIGIBLE"].includes(w.status))
              .map((w) => (
                <div key={w.id} className="px-6 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatNaira(w.netAmount)}{" "}
                      <span className="text-xs font-medium text-gray-500">
                        (gross {formatNaira(w.amount)})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {w.status === "ELIGIBLE"
                        ? "Ready for payout"
                        : w.isInstant
                          ? "Instant — processing"
                          : `Available ${formatRelative(w.noticeUntil)}`}
                    </p>
                  </div>
                  {w.status === "PENDING" && (
                    <button
                      onClick={() => cancelWithdrawal(w.id)}
                      disabled={busy}
                      className="text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Recent activity</h2>
          <Link
            href="/partner/reserve/history"
            className="text-xs font-bold text-brand-700 hover:text-brand-800"
          >
            See all →
          </Link>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Nothing here yet. Your next confirmed booking will start your Reserve.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {movements.map((m) => (
              <MovementRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>

      {/* Trust note + pause */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg space-y-3 text-xs text-gray-500 leading-relaxed">
        <p>
          Your Reserve is your money. Held in your name. Groomee never withdraws
          from it without your permission. Cleared CBN-compliantly.
        </p>
        <button
          onClick={() => setShowPause(true)}
          className="text-xs font-bold text-gray-500 hover:text-red-600"
        >
          Pause Reserve
        </button>
      </div>

      {/* Modals */}
      {showWithdraw && (
        <WithdrawModal
          summary={summary}
          busy={busy}
          onClose={() => setShowWithdraw(false)}
          onDone={async () => {
            setShowWithdraw(false);
            await refresh();
          }}
          onError={(msg) => setError(msg)}
        />
      )}
      {showPause && (
        <ConfirmModal
          title="Pause Reserve?"
          body="You can turn it back on any time. Existing balance stays put."
          confirmLabel="Pause"
          onConfirm={optOut}
          onCancel={() => setShowPause(false)}
          busy={busy}
        />
      )}
      {showGoals && (
        <GoalsModal
          initial={summary.goals.map((g) => g.name)}
          onClose={() => setShowGoals(false)}
          onSave={saveGoals}
          busy={busy}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function BalanceChip({
  label,
  amount,
  hint,
  highlight,
}: {
  label: string;
  amount: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "bg-amber-50 border-amber-200" : "bg-white/60 border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>
        {formatNaira(amount)}
      </p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function MovementRow({ m }: { m: Movement }) {
  const label = MOVEMENT_LABEL[m.type] ?? m.type;
  const isCredit = m.amount > 0;
  const isZero = Math.abs(m.amount) < 0.005;
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">
          {new Date(m.createdAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
      {!isZero && (
        <p className={`font-mono text-sm font-bold ${isCredit ? "text-brand-700" : "text-gray-700"}`}>
          {isCredit ? "+" : ""}
          {formatNaira(m.amount)}
        </p>
      )}
    </div>
  );
}

function OptInScreen({
  summary,
  onOptIn,
  busy,
  error,
}: {
  summary: Summary;
  onOptIn: (rate?: number) => void | Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [rate, setRate] = useState(summary.rate);
  const preview = Math.round(SAMPLE_BOOKING * rate);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings Reserve</h1>
        <p className="text-sm text-gray-500">A cushion that grows on its own.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl border border-white/20 p-6 sm:p-8 shadow-lg space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
            New
          </p>
          <h2 className="mt-1 text-xl font-black text-gray-900 leading-snug">
            Build a cushion automatically.
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Every confirmed booking sets aside a small share of your earnings
            into your Reserve. You stay in control — withdraw any time with
            notice, or instantly with a small fee.
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 border border-gray-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Try the slider
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-sm text-gray-700">Set aside {pct(rate)} of each booking</p>
            <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-base font-black text-brand-700">
              {pct(rate)}
            </span>
          </div>
          <input
            type="range"
            min={Math.round(summary.config.minRate * 100)}
            max={Math.round(summary.config.maxRate * 100)}
            step={1}
            value={Math.round(rate * 100)}
            onChange={(e) => setRate(parseInt(e.target.value, 10) / 100)}
            className="mt-3 w-full accent-brand-700"
          />
          <p className="mt-2 text-xs text-gray-500">
            At {pct(rate)} on a ₦{SAMPLE_BOOKING.toLocaleString("en-NG")} booking, ₦
            <strong className="text-gray-900">{preview.toLocaleString("en-NG")}</strong> goes to your Reserve.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="text-brand-700">●</span>
            Withdraw any time. {summary.config.noticeDays}-day notice is free.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">●</span>
            Need it today? Instant withdrawal — {pct(summary.config.instantPenaltyPct)} fee.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">●</span>
            Loyalty bonus on every notice withdrawal — {pct(summary.config.matchBonusPct)} of what you pull.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">●</span>
            Pause any time. Existing balance stays put.
          </li>
        </ul>

        <button
          onClick={() => onOptIn(rate)}
          disabled={busy}
          className="w-full rounded-2xl bg-brand-700 px-4 py-3.5 text-base font-black text-white shadow-lg disabled:bg-gray-300"
        >
          {busy ? "Turning on…" : "Turn on Reserve"}
        </button>
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          Your Reserve is your money. Held in your name. Cleared CBN-compliantly.
        </p>
      </div>
    </div>
  );
}

function WithdrawModal({
  summary,
  busy,
  onClose,
  onDone,
  onError,
}: {
  summary: Summary;
  busy: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [kind, setKind] = useState<"notice" | "instant">("notice");
  const [submitting, setSubmitting] = useState(false);

  const n = parseFloat(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= summary.balanceAvailable;

  // Live preview using the same formula the lib uses on the server.
  const preview = useMemo(() => {
    if (!Number.isFinite(n) || n <= 0) {
      return { fee: 0, net: 0, bonus: 0, payout: 0 };
    }
    if (kind === "instant") {
      const fee = Math.round(n * summary.instantPenaltyPct * 100) / 100;
      return { fee, net: n - fee, bonus: 0, payout: n - fee };
    }
    const bonus = Math.round(n * summary.config.matchBonusPct * 100) / 100;
    return { fee: 0, net: n, bonus, payout: n + bonus };
  }, [n, kind, summary]);

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/reserve/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRequested: n, kind }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      await onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not request withdrawal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Withdraw from Reserve">
      <p className="text-xs text-gray-500">
        Available now: <strong className="text-gray-900">{formatNaira(summary.balanceAvailable)}</strong>
      </p>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Amount</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-mono"
        />
      </label>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setKind("notice")}
          className={`w-full rounded-xl border p-3 text-left transition ${
            kind === "notice"
              ? "border-brand-700 bg-brand-50"
              : "border-gray-200 bg-white/70"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">Notice — no fee</p>
            <span className="text-xs text-gray-500">+{pct(summary.config.matchBonusPct)} bonus</span>
          </div>
          <p className="text-xs text-gray-500">
            Available in {summary.noticeDays} days. You earn a loyalty bonus on top.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setKind("instant")}
          className={`w-full rounded-xl border p-3 text-left transition ${
            kind === "instant"
              ? "border-amber-500 bg-amber-50"
              : "border-gray-200 bg-white/70"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">
              Instant — {pct(summary.instantPenaltyPct)} fee
            </p>
            <span className="text-xs text-gray-500">Available now</span>
          </div>
          <p className="text-xs text-gray-500">
            Skip the wait. A small fee is kept by Groomee.
          </p>
        </button>
      </div>

      {valid && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-1">
          {kind === "instant" ? (
            <>
              <Line label="Fee" value={`− ${formatNaira(preview.fee)}`} muted />
              <Line label="You get" value={formatNaira(preview.payout)} bold />
            </>
          ) : (
            <>
              <Line label="Loyalty bonus" value={`+ ${formatNaira(preview.bonus)}`} muted />
              <Line label="You get" value={formatNaira(preview.payout)} bold />
              <p className="text-[11px] text-gray-500 pt-1">
                Funds will land in your bank account on file.
              </p>
            </>
          )}
        </div>
      )}

      {!valid && n > summary.balanceAvailable && (
        <p className="text-xs text-red-600">
          That&apos;s more than your available Reserve.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!valid || submitting || busy}
          className="flex-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300"
        >
          {submitting ? "Requesting…" : "Request"}
        </button>
      </div>
    </ModalShell>
  );
}

function GoalsModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: string[];
  onClose: () => void;
  onSave: (goals: string[]) => void | Promise<void>;
  busy: boolean;
}) {
  const PRESETS = ["Rent", "School fees", "Tools"];
  const [goals, setGoals] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function toggle(name: string) {
    setGoals((g) =>
      g.includes(name) ? g.filter((x) => x !== name) : g.length >= 3 ? g : [...g, name],
    );
  }
  function addCustom() {
    const name = draft.trim().slice(0, 32);
    if (!name || goals.includes(name) || goals.length >= 3) return;
    setGoals((g) => [...g, name]);
    setDraft("");
  }

  return (
    <ModalShell onClose={onClose} title="Your goals">
      <p className="text-xs text-gray-500">
        Pick up to 3 things you&apos;re saving for. Names only — they don&apos;t lock your money in any way.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((name) => {
          const selected = goals.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                selected
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              {selected ? "✓ " : "+ "}
              {name}
            </button>
          );
        })}
        {goals
          .filter((g) => !PRESETS.includes(g))
          .map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              className="rounded-full border border-brand-700 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"
            >
              ✓ {g}
            </button>
          ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 32))}
          placeholder="Add your own"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim() || goals.length >= 3}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="text-[11px] text-gray-400">{goals.length}/3 goals</p>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(goals)}
          disabled={busy}
          className="flex-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <ModalShell onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600">{body}</p>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300"
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Line({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? "text-gray-500" : "text-gray-700"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}
