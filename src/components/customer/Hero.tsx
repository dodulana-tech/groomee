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
    <section className="relative overflow-hidden bg-[#f7f5f0]">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(83,235,100,0.07)_0%,transparent_70%)]" />
        <div className="absolute -left-20 bottom-0 h-[350px] w-[350px] rounded-full bg-[radial-gradient(circle,rgba(255,254,161,0.05)_0%,transparent_70%)]" />
        <div
          className="absolute -right-16 -top-16 h-[420px] w-[420px] rounded-full border border-[rgba(37,135,79,0.06)]"
          style={{ animation: "spin 45s linear infinite" }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid min-h-[calc(100dvh-68px)] grid-cols-1 items-center gap-10 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-0">

          {/* ── LEFT: Copy ── */}
          <div className="pt-16 lg:pt-0">
            {/* Headline */}
            <h1
              className="font-display opacity-0"
              style={{
                fontSize: "clamp(2rem, 5vw, 4.2rem)",
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                color: "#0a0a0a",
                animation: "fadeUp 0.7s ease 0.08s forwards",
              }}
            >
              Your{" "}
              <span className="relative inline-block">
                <span className="relative z-10 italic text-[#014342]">beauty&nbsp;pro,</span>
                <svg
                  className="absolute -bottom-1 left-0 w-full opacity-0"
                  style={{ animation: "fadeIn 0.6s ease 0.7s forwards" }}
                  viewBox="0 0 200 12"
                  fill="none"
                  preserveAspectRatio="none"
                  height="10"
                >
                  <path
                    d="M2 8c30-8 60-4 90 0s65 6 106-2"
                    stroke="#53eb64"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="200"
                    strokeDashoffset="200"
                    style={{ animation: "swooshDraw 0.8s ease 0.8s forwards" }}
                  />
                </svg>
              </span>
              <br />
              at your door,
              <br />
              <span className="text-[#014342]">right&nbsp;now.</span>
            </h1>

            {/* Subhead */}
            <p
              className="mt-5 max-w-[420px] text-[0.95rem] leading-[1.7] text-[#3c4d3d] opacity-0 sm:text-base"
              style={{ animation: "fadeUp 0.7s ease 0.16s forwards" }}
            >
              Vetted hair, makeup, nails, lashes &amp; barbing professionals
              delivered to you in Lagos. Late nights, early mornings,
              last-minute&nbsp;&mdash; we&apos;ve got you.
            </p>

            {/* CTAs */}
            <div
              className="mt-7 flex flex-wrap gap-3 opacity-0"
              style={{ animation: "fadeUp 0.7s ease 0.24s forwards" }}
            >
              <Link
                href="/search"
                className="group inline-flex items-center gap-2 rounded-xl bg-[#53eb64] px-5 py-3 text-sm font-bold text-[#0a0a0a] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(83,235,100,0.35)] sm:px-6 sm:py-3.5 sm:text-[0.95rem]"
              >
                <span className="inline-block transition-transform group-hover:scale-110">✦</span>
                Book a pro in Lagos
              </Link>
              <Link
                href="#waitlist"
                className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-[#ddd0fa] bg-[#f5f0ff] px-5 py-3 text-sm font-semibold text-[#7c3aed] transition-all hover:-translate-y-0.5 hover:border-[#c4b0f5] hover:shadow-md sm:px-6 sm:py-3.5 sm:text-[0.95rem]"
              >
                Join Abuja waitlist
              </Link>
            </div>

            {/* Stats */}
            <div
              className="mt-8 flex items-center gap-6 opacity-0 sm:gap-8"
              style={{ animation: "fadeUp 0.7s ease 0.32s forwards" }}
            >
              {[
                { val: "50+", label: "Vetted pros" },
                { val: "<45min", label: "Avg arrival" },
                { val: "24/7", label: "Emergency slots" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-6 sm:gap-8">
                  {i > 0 && (
                    <div className="h-8 w-px shrink-0 bg-[#b4f5bb]" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-medium text-[#014342] sm:text-xl" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {s.val}
                    </span>
                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#7a9a7c] sm:text-[0.65rem]">
                      {s.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Booking card ── */}
          <div
            className="relative pb-8 opacity-0 lg:pb-0"
            style={{ animation: "scaleIn 0.7s ease 0.2s forwards" }}
          >
            {/* Glow behind card */}
            <div className="pointer-events-none absolute -inset-6 hidden rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(83,235,100,0.06)_0%,transparent_70%)] lg:block" />

            <div className="relative overflow-hidden rounded-2xl border border-[rgba(13,61,38,0.08)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.03)] sm:rounded-3xl">
              {/* Top accent */}
              <div className="h-1 bg-gradient-to-r from-[#53eb64] via-[#b4f5bb] to-[#fffea1]" />

              <div className="p-5 sm:p-7">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-[#0a0a0a] sm:text-xl">
                    Find a pro near you
                  </h2>
                  <p className="mt-0.5 text-[0.8rem] font-medium tracking-wide text-[#7a9a7c]">
                    Browse by service &middot; Book in 60 seconds
                  </p>
                </div>

                <p className="mb-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#3c4d3d]">
                  What do you need?
                </p>

                {/* Service chips */}
                <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2">
                  {CATEGORIES.map((cat) => {
                    const on = selected === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() =>
                          setSelected((s) => (s === cat.key ? null : cat.key))
                        }
                        className={`flex flex-col items-center gap-1 rounded-xl border-[1.5px] px-2 py-2.5 text-xs font-medium transition-all sm:gap-1.5 sm:py-3 ${
                          on
                            ? "border-[#53eb64] bg-[#e2fce5] text-[#014342] shadow-sm"
                            : "border-[#e8f5ea] bg-[#f7fef8] text-[#3c4d3d] hover:border-[#b4f5bb] hover:bg-[#eefcf0]"
                        }`}
                      >
                        <span className="text-base sm:text-lg">{cat.emoji}</span>
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
                  className={`mb-4 flex w-full items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-all sm:px-4 ${
                    isAsap
                      ? "border-[#c8871a] bg-[#fdf3e0]"
                      : "border-[rgba(200,135,26,0.18)] bg-[#fdf8ee] hover:border-[rgba(200,135,26,0.35)]"
                  }`}
                >
                  <span className="text-base">⚡</span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[0.8rem] font-semibold text-[#0a0a0a]">
                      Emergency / ASAP
                    </span>
                    <span className="block text-[0.7rem] text-[#3c4d3d]">
                      Pros who arrive within 45 min
                    </span>
                  </div>
                  <div
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      isAsap ? "bg-[#c8871a]" : "bg-[#e8c274]"
                    }`}
                  >
                    <div
                      className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all"
                      style={{ left: isAsap ? 19 : 3 }}
                    />
                  </div>
                </button>

                {/* Search CTA */}
                <button
                  onClick={handleSearch}
                  className="group mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#53eb64] px-5 py-3.5 text-sm font-bold text-[#0a0a0a] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(83,235,100,0.35)] sm:text-[0.95rem]"
                >
                  <span className="transition-transform group-hover:scale-110">
                    🔍
                  </span>
                  Find available pros
                </button>

                {/* Trust line */}
                <p className="flex items-center justify-center gap-1.5 text-center text-[0.7rem] font-medium text-[#7a9a7c]">
                  <span>🛡️</span>
                  All pros vetted &amp; ID-verified &middot; Secured by Paystack
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scroll indicator (desktop) ── */}
      <div className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 lg:flex">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-[#7a9a7c]/60">
          Scroll
        </span>
        <div className="h-7 w-[18px] rounded-full border-[1.5px] border-[#7a9a7c]/30 p-[3px]">
          <div
            className="h-1.5 w-1.5 rounded-full bg-[#7a9a7c]/50"
            style={{ animation: "float 2s ease-in-out infinite" }}
          />
        </div>
      </div>
    </section>
  );
}
