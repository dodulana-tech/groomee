"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitationActions({
  id,
  masterName,
}: {
  id: string;
  masterName: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function handle(kind: "accept" | "decline") {
    if (kind === "decline" && !confirm("Decline this apprenticeship invitation? You can always be invited again later.")) {
      return;
    }
    setSubmitting(kind);
    setError("");
    try {
      const res = await fetch(`/api/partner/apprentices/${id}/${kind}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error ?? "Action failed. Try again.");
        setSubmitting(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(null);
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handle("accept")}
          disabled={submitting !== null}
          className="btn-primary btn-md flex-1"
        >
          {submitting === "accept" ? "Accepting…" : "Accept invitation"}
        </button>
        <button
          onClick={() => handle("decline")}
          disabled={submitting !== null}
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex-1"
        >
          {submitting === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        By accepting you agree to apprentice under {masterName} on Groomee&apos;s standard apprenticeship terms.
      </p>
    </div>
  );
}
