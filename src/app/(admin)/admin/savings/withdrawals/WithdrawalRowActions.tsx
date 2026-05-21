"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  withdrawalId: string;
  status: string;
  bankReady: boolean;
}

export default function WithdrawalRowActions({ withdrawalId, status, bankReady }: Props) {
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
    <div className="flex flex-col gap-1">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <div className="flex gap-1.5">
        {(status === "PENDING" || status === "ELIGIBLE") && (
          <>
            {status === "PENDING" && (
              <button
                disabled={busy}
                onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/force-mature`)}
                className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-200"
              >
                Force mature
              </button>
            )}
            {status === "ELIGIBLE" && (
              <button
                disabled={busy || !bankReady}
                title={!bankReady ? "Add bank details to pro profile first" : undefined}
                onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/release`)}
                className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Release →
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/cancel`)}
              className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </>
        )}
        {status === "FAILED" && (
          <button
            disabled={busy || !bankReady}
            onClick={() => call(`/api/admin/savings/withdrawals/${withdrawalId}/retry`)}
            className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Retry release
          </button>
        )}
      </div>
    </div>
  );
}
