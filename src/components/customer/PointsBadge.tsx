"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PointsBadge() {
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/profile/points")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const val = data.points ?? data.data?.points;
        if (typeof val === "number") setPoints(val);
      })
      .catch(() => {});
  }, []);

  if (points === null) return null;

  return (
    <Link
      href="/profile/points"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.78rem",
        fontWeight: 600,
        color: "#53eb64",
        background: "rgba(83,235,100,0.12)",
        border: "1px solid rgba(83,235,100,0.25)",
        borderRadius: 20,
        padding: "0.3rem 0.65rem",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "background 0.2s",
      }}
      title="Your loyalty points"
    >
      ✨ {points} pts
    </Link>
  );
}
