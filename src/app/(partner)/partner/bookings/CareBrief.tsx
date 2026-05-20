"use client";

import { useState } from "react";

interface BriefCondition {
  code: string;
  label: string;
  category: string;
  severity: "MILD" | "MODERATE" | "SEVERE";
  notes?: string | null;
  hint?: string | null;
}

interface BriefRule {
  conditionCode: string;
  conditionLabel: string;
  serviceName: string | null;
  level: "INFO" | "WARN" | "BLOCK";
  message: string;
}

// Live response from GET /api/partner/bookings/[id]/care-brief
interface BriefResponse {
  frozen: boolean;
  acknowledgedAt: string | null;
  snapshot: {
    profileId?: string;
    visibility?: "ALWAYS_SHARE" | "ASK_PER_BOOKING" | "PRIVATE";
    notes?: string | null;
    conditions: BriefCondition[];
    // only present on live (non-frozen) briefs — once acknowledged, the
    // ack snapshot freezes only conditions, not rules
    contraindications?: BriefRule[];
  };
}

const LEVEL_STYLE: Record<
  "INFO" | "WARN" | "BLOCK",
  { box: string; badge: string; icon: string; word: string }
> = {
  BLOCK: {
    box: "border-red-200 bg-red-50",
    badge: "bg-red-600 text-white",
    icon: "🚫",
    word: "DO NOT",
  },
  WARN: {
    box: "border-amber-200 bg-amber-50",
    badge: "bg-amber-500 text-white",
    icon: "⚠️",
    word: "TAKE CARE",
  },
  INFO: {
    box: "border-blue-200 bg-blue-50",
    badge: "bg-blue-500 text-white",
    icon: "ℹ️",
    word: "FYI",
  },
};

interface Props {
  bookingId: string;
  isAccepted: boolean;
}

export default function CareBrief({ bookingId, isAccepted }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [noBrief, setNoBrief] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNoBrief(false);
    try {
      const res = await fetch(`/api/partner/bookings/${bookingId}/care-brief`);
      const json = await res.json();
      if (res.status === 404) {
        setNoBrief(true);
        setBrief(null);
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Failed to load brief.");
        setBrief(null);
        return;
      }
      setBrief(json.data);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function acknowledge() {
    setAckLoading(true);
    try {
      const res = await fetch(
        `/api/partner/bookings/${bookingId}/care-brief/acknowledge`,
        { method: "POST" },
      );
      if (res.ok) await load();
    } finally {
      setAckLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !brief && !noBrief && !loading) load();
  }

  const conditions = brief?.snapshot.conditions ?? [];
  const rules = brief?.snapshot.contraindications ?? [];
  const notes = brief?.snapshot.notes;
  const acknowledged = Boolean(brief?.acknowledgedAt);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        <span className="flex items-center gap-2">
          🩺 Care brief
          {acknowledged && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Acknowledged
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {loading && <p className="text-xs text-gray-400">Loading…</p>}

          {noBrief && !loading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              No care notes shared for this booking.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          {brief && (
            <>
              {/* Actionable rules — only meaningful on live (non-frozen) briefs */}
              {rules.length > 0 &&
                rules.map((r, i) => {
                  const s = LEVEL_STYLE[r.level];
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border ${s.box} p-3 text-sm`}
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-base">{s.icon}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.badge}`}
                        >
                          {s.word}
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                          {r.conditionLabel}
                        </span>
                      </div>
                      <p className="text-gray-800">{r.message}</p>
                    </div>
                  );
                })}

              {brief.frozen && (
                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                  Snapshot taken when you acknowledged. The customer's profile
                  may have changed since.
                </p>
              )}

              {notes && (
                <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Customer notes
                  </p>
                  <p className="text-gray-700">{notes}</p>
                </div>
              )}

              {conditions.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Conditions on file ({conditions.length})
                  </p>
                  <ul className="space-y-1.5">
                    {conditions.map((c) => (
                      <li
                        key={c.code}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">
                            {c.label}
                          </p>
                          {(c.notes || c.hint) && (
                            <p className="text-xs text-gray-500">
                              {c.notes ?? c.hint}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            c.severity === "SEVERE"
                              ? "bg-red-50 text-red-700"
                              : c.severity === "MODERATE"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {c.severity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rules.length === 0 && conditions.length === 0 && !notes && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                  No flagged conditions for the booked services.
                </div>
              )}

              {/* Ack only when the booking is active (ACCEPTED+) and not yet acked */}
              {!acknowledged && isAccepted && (
                <button
                  type="button"
                  onClick={acknowledge}
                  disabled={ackLoading}
                  className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {ackLoading
                    ? "Acknowledging…"
                    : "✓ I've read this — acknowledge"}
                </button>
              )}
              {acknowledged && brief.acknowledgedAt && (
                <p className="text-center text-[11px] text-gray-400">
                  Acknowledged{" "}
                  {new Date(brief.acknowledgedAt).toLocaleString("en-NG")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
