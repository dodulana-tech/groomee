"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  groomerId: string;
  inSquad: boolean;
}

export default function SquadActions({
  groomerId,
  inSquad: initialInSquad,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inSquad, setInSquad] = useState(initialInSquad);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/squad", {
        method: inSquad ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groomerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      setInSquad(!inSquad);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
        inSquad
          ? "bg-brand-100 text-brand-700 hover:bg-red-50 hover:text-red-500"
          : "bg-brand-600 text-white hover:bg-brand-700"
      }`}
    >
      {loading ? "…" : inSquad ? "✓ In your squad" : "+ Add to squad"}
    </button>
  );
}
