"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  withdrawalId: string;
  status: string;
}

export default function WithdrawalActions({ withdrawalId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) setError(json.error ?? "Request failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5 items-center">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status === "PENDING" && (
        <>
          <button
            disabled={busy}
            onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/force-mature`)}
            className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-200"
          >
            Force mature
          </button>
          <button
            disabled={busy}
            onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/cancel`)}
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </>
      )}
      {status === "ELIGIBLE" && (
        <>
          <button
            disabled={busy}
            onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/release`)}
            className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white hover:bg-brand-700"
          >
            Release →
          </button>
          <button
            disabled={busy}
            onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/cancel`)}
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
