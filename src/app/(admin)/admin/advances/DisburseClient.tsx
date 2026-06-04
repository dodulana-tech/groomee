"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Props {
  advanceId: string;
  amount: number;
  proHasBank: boolean;
}

// Two disburse paths:
//   - "disburse" → manual settlement (admin pays the pro externally, just log the wallet posting)
//   - "disburse_paystack" → initiate a Paystack transfer to the pro's saved bank
// Both flip the ProAdvance row to DISBURSED and post ADVANCE_DISBURSED to the wallet.
export default function DisburseClient({ advanceId, amount, proHasBank }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "disburse" | "disburse_paystack">(null);
  const [open, setOpen] = useState(false);

  async function run(action: "disburse" | "disburse_paystack") {
    const confirmMsg =
      action === "disburse_paystack"
        ? `Initiate a Paystack transfer of ${formatNaira(amount)} to the pro's bank AND post the wallet movement?`
        : `Mark this advance as disbursed (manual settlement) and post the wallet movement of ${formatNaira(amount)}?`;
    if (!confirm(confirmMsg)) return;
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/advances/${advanceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to disburse");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"
      >
        Disburse
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]">
      <button
        onClick={() => run("disburse_paystack")}
        disabled={!!loading || !proHasBank}
        title={proHasBank ? "" : "Pro bank details missing"}
        className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
      >
        {loading === "disburse_paystack" ? "…" : `Paystack ${formatNaira(amount)}`}
      </button>
      <button
        onClick={() => run("disburse")}
        disabled={!!loading}
        className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700"
      >
        {loading === "disburse" ? "…" : "Manual settlement"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-gray-400"
      >
        cancel
      </button>
    </div>
  );
}
