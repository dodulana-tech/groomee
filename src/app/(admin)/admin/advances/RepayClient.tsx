"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

export default function RepayClient({
  advanceId,
  amount,
}: {
  advanceId: string;
  amount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markRepaid() {
    if (!confirm(`Mark advance of ${formatNaira(amount)} as repaid?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/advances/${advanceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repay" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to mark repaid");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={markRepaid}
      disabled={loading}
      className="rounded-lg bg-green-100 px-3 py-1 text-xs font-bold text-green-700 hover:bg-green-200 disabled:opacity-50"
    >
      {loading ? "…" : "Mark repaid"}
    </button>
  );
}
