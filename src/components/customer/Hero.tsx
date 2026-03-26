"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Service } from "@/types";

const CATEGORIES = [
  { key: "HAIR", label: "Hair", emoji: "💇🏿‍♀️" },
  { key: "MAKEUP", label: "Makeup", emoji: "💄" },
  { key: "NAILS", label: "Nails", emoji: "💅🏿" },
  { key: "BARBING", label: "Barbing", emoji: "✂️" },
  { key: "LASHES", label: "Lashes", emoji: "👁️" },
  { key: "SKINCARE", label: "Skincare", emoji: "✨" },
];

interface Props {
  services: Service[];
}

export default function Hero({ services }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isAsap, setIsAsap] = useState(false);

  function handleSearch() {
    const params = new URLSearchParams();
    if (selected) {
      const svc = services.find((s) => s.category === selected);
      if (svc) params.set("service", svc.slug);
    }
    if (isAsap) params.set("asap", "true");
    router.push(`/search?${params.toString()}`);
  }

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-2"
      style={{
        minHeight: "100vh",
        padding: "100px 5% 60px",
        gap: "4rem",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        background: "#f7f5f0",
      }}
    >
      {/* Decorative gradients */}
      <div
        style={{
          content: "''",
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 80% 20%, rgba(83,235,100,0.07) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 10% 80%, rgba(255,254,161,0.06) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: "1.5px solid rgba(37,135,79,0.1)",
          top: -80,
          right: -80,
          animation: "spin 30s linear infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: "1px solid rgba(200,135,26,0.1)",
          bottom: 60,
          left: -60,
          pointerEvents: "none",
        }}
      />

      {/* LEFT */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Headline - exactly 3 lines */}
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(1.8rem, 5vw, 5rem)",
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            marginBottom: 24,
          }}
        >
          Your <span style={{ color: "#016060", fontStyle: "italic" }}>beauty pro,</span>
          <br />
          at your door,
          <br />
          right now.
        </h1>

        <p
          style={{
            fontSize: "1.05rem",
            fontWeight: 400,
            color: "#3c4d3d",
            lineHeight: 1.7,
            maxWidth: 460,
            marginBottom: 28,
          }}
        >
          Vetted hair, makeup, nails, lashes &amp; barbing professionals
          delivered to you in Lagos. No salon run. No traffic. Available late
          nights, early mornings, and last-minute.
        </p>

        {/* Dual CTA */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 28 }}>
          <Link
            href="/search"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "12px 24px",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#0a0a0a",
              background: "#53eb64",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              textDecoration: "none",
            }}
          >
            🟢 Get started in Lagos
          </Link>
          <Link
            href="#abuja-waitlist"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "12px 24px",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#7c3aed",
              background: "#f5f0ff",
              border: "1.5px solid #ddd0fa",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              textDecoration: "none",
            }}
          >
            🟡 Join the Abuja waitlist
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" as const }}>
          {[
            { val: "50+", label: "Vetted pros" },
            { val: "<45 min", label: "Avg arrival time" },
            { val: "24/7", label: "Emergency slots" },
          ].map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {i > 0 && (
                <div style={{ width: 1, height: 36, background: "#b4f5bb", flexShrink: 0 }} />
              )}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "1.4rem",
                    fontWeight: 500,
                    color: "#014342",
                  }}
                >
                  {s.val}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#7a9a7c", letterSpacing: "0.04em" }}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Booking card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "#fff",
          border: "1px solid rgba(13,61,38,0.08)",
          borderRadius: 24,
          padding: "2rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        {/* Top gradient accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #53eb64, #fffea1)",
          }}
        />

        <h2
          className="font-display"
          style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0a0a0a", marginBottom: 4 }}
        >
          Find a pro near you
        </h2>
        <p style={{ fontSize: "0.8rem", color: "#7a9a7c", marginBottom: 24, fontWeight: 500, letterSpacing: "0.03em" }}>
          Browse by service · Book in 60 seconds
        </p>

        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3c4d3d", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
          What do you need?
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 8, marginBottom: 20 }}>
          {CATEGORIES.map((cat) => {
            const on = selected === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelected((s) => (s === cat.key ? null : cat.key))}
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  gap: 4,
                  padding: "11px 8px",
                  border: `1.5px solid ${on ? "#53eb64" : "#b4f5bb"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: on ? "#e2fce5" : "#f1fef2",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: on ? "#014342" : "#3c4d3d",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{cat.emoji}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ASAP toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isAsap}
          aria-label="Emergency ASAP booking"
          onClick={() => setIsAsap((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: "#fdf3e0",
            border: "1.5px solid rgba(200,135,26,0.25)",
            borderRadius: 10,
            marginBottom: 20,
            cursor: "pointer",
            width: "100%",
            textAlign: "left" as const,
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>⚡</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0a0a0a", display: "block" }}>
              Emergency / ASAP booking
            </span>
            <span style={{ fontSize: "0.75rem", color: "#3c4d3d", display: "block" }}>
              Pros who can arrive within 45 minutes
            </span>
          </div>
          <div
            style={{
              width: 36,
              height: 20,
              background: isAsap ? "#c8871a" : "#e8c274",
              borderRadius: 100,
              position: "relative",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: isAsap ? 19 : 3,
                width: 14,
                height: 14,
                background: "#fff",
                borderRadius: "50%",
                transition: "left 0.2s",
              }}
            />
          </div>
        </button>

        <button
          onClick={handleSearch}
          style={{
            width: "100%",
            background: "#53eb64",
            color: "#0a0a0a",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "1rem",
            fontWeight: 600,
            border: "none",
            padding: 15,
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
            transition: "all 0.2s",
            letterSpacing: "0.01em",
          }}
        >
          🔍 Find available pros
        </button>

        <p style={{ textAlign: "center" as const, fontSize: "0.75rem", color: "#7a9a7c", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          🛡️ All pros vetted &amp; ID-verified · Payment secured by Paystack
        </p>
      </div>
    </section>
  );
}
