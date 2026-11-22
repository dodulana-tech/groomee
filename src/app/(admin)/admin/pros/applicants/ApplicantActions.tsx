"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_PRESETS = [
  "We need photos of at least 3 recent clients' finished looks. Please add your Instagram or portfolio link.",
  "We're not onboarding new pros in your area yet. We'll reach out as soon as we expand there.",
  "We couldn't reach you on WhatsApp to complete vetting. Please reply to our message and re-apply.",
  "Your experience doesn't yet meet our minimum for this service. Our apprenticeship path may be a great fit.",
];

export default function ApplicantActions({
  proId,
  name,
  compact = false,
}: {
  proId: string;
  name: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function review(action: "approve" | "reject") {
    setError("");
    if (action === "approve" && !confirm(`Approve ${name}? They'll get the welcome WhatsApp right away.`)) {
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/pros/${proId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action } : { action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (res.status === 409) router.refresh();
        return;
      }
      setDone(action === "approve" ? "Approved · welcome sent" : "Declined · message sent");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return <p className="text-sm font-semibold text-green-700">{done}</p>;
  }

  return (
    <div className={compact ? "w-full space-y-2" : "w-full space-y-2 lg:w-80"}>
      {mode === "idle" ? (
        <div className="flex gap-2">
          <button
            onClick={() => review("approve")}
            disabled={busy !== null}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: "#53eb64", color: "#014342" }}
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => setMode("reject")}
            disabled={busy !== null}
            className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Decline…
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-3">
          <label className="block text-xs font-bold text-gray-700">
            Reason (sent to {name.split(" ")[0]} on WhatsApp)
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
            value=""
            onChange={(e) => e.target.value && setReason(e.target.value)}
          >
            <option value="">Pick a common reason…</option>
            {REASON_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r.length > 70 ? `${r.slice(0, 70)}…` : r}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Be kind and specific: what would get them approved next time?"
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => review("reject")}
              disabled={busy !== null || reason.trim().length < 10}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy === "reject" ? "Sending…" : "Decline & send"}
            </button>
            <button
              onClick={() => {
                setMode("idle");
                setError("");
              }}
              disabled={busy !== null}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
