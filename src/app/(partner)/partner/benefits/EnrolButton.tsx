"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnrolButton({
  planId,
  disabled,
}: {
  planId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enrol() {
    if (disabled) return;
    if (
      !confirm(
        "Enrol now? Your first premium will be debited from your Groomee wallet today and on the 1st of every month after that.",
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/partner/benefits/enrol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        const reasons = Array.isArray(data.reasons) ? data.reasons.join(" • ") : "";
        setError(data.error + (reasons ? ` — ${reasons}` : ""));
        return;
      }
      router.refresh();
    } catch {
      setError("Could not enrol. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={enrol}
        disabled={disabled || loading}
        className={`w-full sm:w-auto rounded-xl px-6 py-3 text-sm font-black shadow-lg transition ${
          disabled
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-green-500 text-white hover:bg-green-600"
        }`}
      >
        {loading ? "Enroling..." : disabled ? "Not eligible yet" : "Enrol now"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 font-semibold">{error}</p>
      )}
    </div>
  );
}
