"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Props {
  advanceId: string;
  groomerName: string;
  amount: number;
}

export default function AdvanceActions({
  advanceId,
  groomerName,
  amount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  async function execute() {
    if (!action) return;
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/advances/${advanceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
      setShowNote(false);
      setAction(null);
    }
  }

  if (showNote) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            action === "approve"
              ? "Approval note (optional)"
              : "Reason for rejection…"
          }
          className="rounded-lg border border-gray-200 p-2 text-xs resize-none"
          rows={2}
        />
        <div className="flex gap-1.5">
          <button
            onClick={execute}
            disabled={!!loading || (action === "reject" && !note.trim())}
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-bold text-white ${action === "approve" ? "bg-brand-600" : "bg-red-500"}`}
          >
            {loading
              ? "…"
              : action === "approve"
                ? `Approve ${formatNaira(amount)}`
                : "Reject"}
          </button>
          <button
            onClick={() => {
              setShowNote(false);
              setAction(null);
            }}
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => {
          setAction("approve");
          setShowNote(true);
        }}
        className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-bold text-white hover:bg-brand-700"
      >
        ✓ Approve
      </button>
      <button
        onClick={() => {
          setAction("reject");
          setShowNote(true);
        }}
        className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-200"
      >
        ✗ Reject
      </button>
    </div>
  );
}
