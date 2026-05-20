"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DependentForBooking {
  id: string;
  name: string;
  photo: string | null;
  relationship: "APPRENTICE" | "STAFF";
  availability: "ONLINE" | "BUSY" | "OFFLINE";
  totalJobs: number;
  avgRating: number;
  serviceIds: string[];
  zoneIds: string[];
}

export interface EligibleDependent {
  id: string;
  name: string;
  photo: string | null;
  relationship: "APPRENTICE" | "STAFF";
  availability: "ONLINE" | "BUSY" | "OFFLINE";
  totalJobs: number;
  avgRating: number;
  /** Non-null when the dependent cannot be deployed for this booking. */
  blockedReason: string | null;
}

// ─── Delegate modal ────────────────────────────────────────────────────────

interface DelegateProps {
  bookingId: string;
  dependents: EligibleDependent[];
}

export function DelegateButton({ bookingId, dependents }: DelegateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (dependents.length === 0) return null;

  async function deploy(apprenticeId: string) {
    setSubmitting(apprenticeId);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apprenticeId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? "Deployment failed");
        setSubmitting(null);
        return;
      }
      setOpen(false);
      setSubmitting(null);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setSubmitting(null);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="rounded-xl border border-brand-200 bg-white/70 px-4 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50 transition-all"
      >
        🤝 Delegate to a pro on your team
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="glass w-full max-w-md rounded-3xl border border-white/30 p-6 shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Deploy this booking
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Hand it to one of your pros. Same booking, their hands.
                </p>
              </div>
              {!submitting && (
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-200"
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
            </div>

            {error && (
              <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dependents.map((d) => {
                const blocked = d.blockedReason !== null;
                return (
                  <button
                    key={d.id}
                    onClick={() =>
                      !blocked && submitting === null && deploy(d.id)
                    }
                    disabled={blocked || submitting !== null}
                    title={d.blockedReason ?? undefined}
                    className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                      blocked
                        ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        : "border-white/30 bg-white/80 hover:border-brand-200 hover:bg-brand-50"
                    } ${submitting === d.id ? "ring-2 ring-brand-300" : ""}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-700 shrink-0">
                      {d.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.photo}
                          alt={d.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        d.name
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {d.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {d.relationship === "APPRENTICE"
                          ? "Apprentice"
                          : "Staff"}{" "}
                        · {d.totalJobs} jobs
                        {d.avgRating > 0
                          ? ` · ★ ${d.avgRating.toFixed(1)}`
                          : ""}
                      </p>
                      {blocked && (
                        <p className="text-xs text-amber-700 mt-0.5 truncate">
                          ⚠ {d.blockedReason}
                        </p>
                      )}
                    </div>
                    {submitting === d.id && (
                      <span className="text-xs font-bold text-brand-600">
                        Sending…
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center">
              Earnings split as agreed in the apprenticeship — your master cut
              comes through automatically when the booking confirms.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Rescind button ────────────────────────────────────────────────────────

interface RescindProps {
  bookingId: string;
  dependentName: string;
}

export function RescindButton({ bookingId, dependentName }: RescindProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function rescind() {
    if (
      !confirm(
        `Take this booking back from ${dependentName}? They will be told it was rescinded — no strike, no penalty.`,
      )
    )
      return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/rescind`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        alert(body.error ?? "Failed to rescind");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Network error");
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={rescind}
      disabled={submitting}
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all disabled:opacity-50"
    >
      {submitting ? "Rescinding…" : "↩ Take booking back"}
    </button>
  );
}

// ─── Status advance button (kept inline for the server-rendered page) ──────

interface StatusAdvanceProps {
  bookingId: string;
  nextStatus: string;
  label: string;
  color: string;
}

export function StatusAdvanceButton({
  bookingId,
  nextStatus,
  label,
  color,
}: StatusAdvanceProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function go() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/partner/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: nextStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Network error");
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={submitting}
      className={`mt-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${color} hover:opacity-90 disabled:opacity-50`}
    >
      {submitting ? "…" : label}
    </button>
  );
}
