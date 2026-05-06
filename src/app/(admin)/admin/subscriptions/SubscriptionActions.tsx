"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionActions({
  subscriptionId,
  status,
  creditsRemaining,
}: {
  subscriptionId: string;
  status: string;
  creditsRemaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "cancel" | "credit">(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [credits, setCredits] = useState<string>("1");

  async function submit(action: "cancel" | "credit") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
          ...(action === "credit" ? { credits: Number(credits) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setOpen(null);
      setReason("");
      setCredits("1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      {status !== "CANCELLED" && (
        <button
          onClick={() => {
            setOpen("cancel");
            setReason("");
            setError(null);
          }}
          className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-200"
        >
          Cancel
        </button>
      )}
      <button
        onClick={() => {
          setOpen("credit");
          setReason("");
          setError(null);
          setCredits("1");
        }}
        className="rounded-lg bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-200"
      >
        Adjust credits
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {open === "cancel" ? "Cancel subscription" : "Adjust credits"}
            </h3>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">
                {error}
              </div>
            )}
            {open === "credit" && (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  Currently {creditsRemaining} credits remaining. Use a negative value to deduct.
                </p>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Credits delta</label>
                <input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3"
                />
              </>
            )}
            <label className="block text-xs font-semibold text-gray-500 mb-1">Reason (audited)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3"
              placeholder={
                open === "cancel"
                  ? "Why is this subscription being cancelled?"
                  : "Why are credits being adjusted?"
              }
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(null)}
                className="text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => submit(open)}
                disabled={
                  submitting ||
                  reason.trim().length < 5 ||
                  (open === "credit" && (!credits || Number(credits) === 0))
                }
                className="text-sm font-semibold text-white bg-brand-600 px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {submitting ? "Saving…" : open === "cancel" ? "Cancel sub" : "Adjust"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
