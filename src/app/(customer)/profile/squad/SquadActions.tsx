"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  groomerId: string;
  action: "add" | "remove";
  onSuccess?: () => void;
}

export default function SquadActions({ groomerId, action, onSuccess }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/squad", {
        method: action === "add" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groomerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      setDone(true);
      onSuccess?.();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (action === "remove") {
    return (
      <button
        onClick={handle}
        disabled={loading}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
      >
        {loading ? "…" : "Remove"}
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={loading || done}
      className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-200 disabled:opacity-50"
    >
      {loading ? "…" : done ? "✓ Added to squad" : "+ Add to squad"}
    </button>
  );
}
