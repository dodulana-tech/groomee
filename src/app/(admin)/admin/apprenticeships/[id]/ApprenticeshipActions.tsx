"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  apprenticeshipId: string;
  status: string;
  canManage: boolean;
  initialCommission: number;
  initialApprovedIndependence: boolean;
}

export default function ApprenticeshipActions({
  apprenticeshipId,
  status,
  canManage,
  initialCommission,
  initialApprovedIndependence,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Commission editor
  const [commissionPct, setCommissionPct] = useState(
    Math.round(initialCommission * 100),
  );
  const [savingCommission, setSavingCommission] = useState(false);

  // Independence toggle
  const [approved, setApproved] = useState(initialApprovedIndependence);

  // Modals
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [freedomOpen, setFreedomOpen] = useState(false);
  const [freedomNote, setFreedomNote] = useState("");

  function reset() {
    setErr(null);
  }

  async function patch(body: Record<string, unknown>, label: string) {
    reset();
    setBusy(label);
    try {
      const res = await fetch(
        `/api/admin/apprenticeships/${apprenticeshipId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Update failed");
        return false;
      }
      router.refresh();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveCommission() {
    if (!canManage) return;
    const pct = Number(commissionPct);
    if (Number.isNaN(pct) || pct < 0 || pct > 60) {
      setErr("Commission must be between 0 and 60%.");
      return;
    }
    setSavingCommission(true);
    try {
      await patch({ masterCommission: pct / 100 }, "commission");
    } finally {
      setSavingCommission(false);
    }
  }

  async function toggleIndependence(next: boolean) {
    if (!canManage) return;
    const ok = await patch(
      { masterApprovedIndependence: next },
      "independence",
    );
    if (ok) setApproved(next);
  }

  async function submitTerminate() {
    if (!canManage) return;
    const reason = terminateReason.trim();
    if (reason.length < 3) {
      setErr("Termination reason is required (min 3 chars).");
      return;
    }
    reset();
    setBusy("terminate");
    try {
      const res = await fetch(
        `/api/admin/apprenticeships/${apprenticeshipId}/terminate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Failed to terminate");
      } else {
        setTerminateOpen(false);
        setTerminateReason("");
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submitForceFreedom() {
    if (!canManage) return;
    reset();
    setBusy("freedom");
    try {
      const res = await fetch(
        `/api/admin/apprenticeships/${apprenticeshipId}/force-freedom`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: freedomNote.trim() || undefined }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Failed to force freedom");
      } else {
        setFreedomOpen(false);
        setFreedomNote("");
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isClosed = status === "FREED" || status === "TERMINATED";

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {err}
        </div>
      )}

      {/* Commission editor */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Master commission
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Master's cut of every dependent earning. Default 30%.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={commissionPct}
              disabled={!canManage}
              onChange={(e) => setCommissionPct(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-gray-50"
            />
            <span className="text-sm font-medium text-gray-500">%</span>
            {canManage && (
              <button
                type="button"
                onClick={saveCommission}
                disabled={
                  savingCommission ||
                  busy === "commission" ||
                  Math.round(initialCommission * 100) === commissionPct
                }
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingCommission ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Independence toggle */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Master-approved independence
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Admin override of the master's approval gate. Required for the
              apprentice to take their own bookings.
            </p>
          </div>
          <button
            type="button"
            disabled={!canManage || busy === "independence"}
            onClick={() => toggleIndependence(!approved)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              approved
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } disabled:opacity-50`}
          >
            {busy === "independence"
              ? "…"
              : approved
                ? "✓ Approved"
                : "Not approved"}
          </button>
        </div>
      </div>

      {/* Override actions */}
      {canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Admin overrides
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">
              Use carefully — every action is audit-logged.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isClosed || busy !== null}
              onClick={() => setFreedomOpen(true)}
              className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              ✨ Force Freedom
            </button>
            <button
              type="button"
              disabled={status === "TERMINATED" || busy !== null}
              onClick={() => setTerminateOpen(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              ✕ Terminate
            </button>
          </div>
        </div>
      )}

      {/* Terminate modal */}
      {terminateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Terminate apprenticeship?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This will end the relationship immediately. The apprentice's Pro
              record will be reset to INDEPENDENT and detached from the master.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Reason (required)
              </span>
              <textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                placeholder="e.g. Master misconduct reported by ops"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTerminateOpen(false);
                  setTerminateReason("");
                  reset();
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === "terminate"}
                onClick={submitTerminate}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === "terminate" ? "Terminating…" : "Terminate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force-freedom modal */}
      {freedomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Force Freedom?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This bypasses the auto-readiness gate and grants Freedom
              immediately. A certificate code will be generated.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Note (optional)
              </span>
              <textarea
                value={freedomNote}
                onChange={(e) => setFreedomNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                placeholder="e.g. Manual freedom — master signed off offline"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFreedomOpen(false);
                  setFreedomNote("");
                  reset();
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === "freedom"}
                onClick={submitForceFreedom}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {busy === "freedom" ? "Granting…" : "Grant Freedom"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
