"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelCoverButton({
  enrollmentId,
}: {
  enrollmentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `/api/partner/benefits/enrollments/${enrollmentId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await r.json();
      if (!r.ok || !data.success) {
        setError(data.error ?? "Could not cancel cover.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not cancel cover. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold text-red-600 hover:text-red-700 underline"
      >
        Cancel cover
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900">
              Cancel your cover?
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              You'll lose protection immediately. Re-enrolment requires a fresh{" "}
              <strong>30-day waiting period</strong> before cover begins again.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Why are you cancelling? (optional, helps us improve)
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={240}
              placeholder="Optional"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {error && (
              <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
              >
                Keep my cover
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
