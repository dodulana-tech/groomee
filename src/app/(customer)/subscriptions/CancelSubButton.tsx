"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelSubButton({ subId }: { subId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of this billing period.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to cancel. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="mt-2 text-xs text-red-500 hover:underline disabled:opacity-50"
    >
      {loading ? "Cancelling..." : "Cancel plan"}
    </button>
  );
}
