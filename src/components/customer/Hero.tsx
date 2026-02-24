"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Service } from "@/types";
import { getServiceCategoryIcon } from "@/lib/utils";

const CATEGORIES = [
  { key: "HAIR", label: "Hair", emoji: "💇‍♀️" },
  { key: "MAKEUP", label: "Makeup", emoji: "💄" },
  { key: "NAILS", label: "Nails", emoji: "💅" },
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
    <section className="relative overflow-hidden bg-brand-600 pb-20 pt-10 sm:pb-24 sm:pt-16">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
      <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-white/5" />
      <div className="absolute right-1/4 top-1/3 h-48 w-48 rounded-full bg-brand-500/30" />

      <div className="container relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_480px] lg:items-center">
          {/* LEFT: Headline */}
          <div className="text-center lg:text-left">
            {/* Kicker pill */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-green-400" />
              Now live in Lagos
            </div>

            <h1 className="font-display text-4xl font-black leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Your groomer,
              <br />
              <em className="not-italic text-green-300">at your door</em>,
              <br />
              right now.
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/75 lg:mx-0 lg:text-lg">
              Professional hair, makeup, nails, lashes & barbing delivered to
              you in Lagos. No salon. No traffic. Available late nights and
              early mornings.
            </p>

            {/* Stats */}
            <div className="mt-8 flex justify-center gap-8 lg:justify-start">
              {[
                { val: "50+", label: "Vetted groomers" },
                { val: "< 45 min", label: "Avg arrival time" },
                { val: "24/7", label: "Emergency slots" },
              ].map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <p className="text-2xl font-extrabold text-white">{s.val}</p>
                  <p className="mt-0.5 text-xs text-white/55">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Trust badges — mobile only */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:hidden">
              {["🛡️ ID Verified", "💳 Secure pay", "⭐ 4.8 rated"].map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT: Search card */}
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.2)] lg:mx-0">
            <h2 className="font-display text-xl font-bold text-gray-900">
              Find a groomer near you
            </h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">
              Browse by service · Book in 60 seconds
            </p>

            {/* Category grid */}
            <p className="input-label mb-2">What do you need?</p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selected === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() =>
                      setSelected((s) => (s === cat.key ? null : cat.key))
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 px-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50 text-brand-700 scale-105 shadow-sm"
                        : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* ASAP toggle */}
            <button
              type="button"
              onClick={() => setIsAsap((v) => !v)}
              className={`mb-4 flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
                isAsap
                  ? "border-accent bg-accent-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-accent/30"
              }`}
            >
              <span className="text-2xl">⚡</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-600">
                  Emergency / ASAP booking
                </p>
                <p className="text-[11px] text-gray-500">
                  Groomers who can arrive within 45 minutes
                </p>
              </div>
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${isAsap ? "bg-accent" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isAsap ? "left-[18px]" : "left-0.5"}`}
                />
              </div>
            </button>

            <button
              onClick={handleSearch}
              className="btn-primary btn-lg w-full text-base"
            >
              🔍 Find available groomers
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <span className="text-brand-500">🛡️</span>
              All groomers vetted & ID-verified · Payment secured
            </p>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div
        className="absolute bottom-0 left-0 right-0 h-8 bg-white"
        style={{ clipPath: "ellipse(55% 100% at 50% 100%)" }}
      />
    </section>
  );
}
