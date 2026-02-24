"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  slug: string;
  category: string;
  icon: string;
  minPrice: number;
  isPopular: boolean;
}

const QUICK_PICKS = [
  { label: "Knotless Braids", slug: "knotless-braids", icon: "💇‍♀️" },
  { label: "Full Glam", slug: "full-glam", icon: "💄" },
  { label: "Gel Nails", slug: "gel-nails", icon: "💅" },
  { label: "Fade", slug: "fade", icon: "✂️" },
];

export default function HeroSearch({ services }: { services: Service[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isAsap, setIsAsap] = useState(false);

  function search() {
    const params = new URLSearchParams();
    if (selected) params.set("service", selected);
    if (isAsap) params.set("asap", "true");
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl shadow-forest-500/20">
      <h2 className="font-display text-xl font-bold text-ink mb-1">
        Find a groomer near you
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Browse by service · 45 min delivery in Lagos
      </p>

      {/* Quick picks */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          Quick pick
        </p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick.slug}
              onClick={() =>
                setSelected((v) => (v === pick.slug ? null : pick.slug))
              }
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                selected === pick.slug
                  ? "border-forest-400 bg-forest-50 text-forest-500"
                  : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
              }`}
            >
              <span className="text-lg">{pick.icon}</span>
              {pick.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency toggle */}
      <button
        onClick={() => setIsAsap((v) => !v)}
        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 mb-5 transition-all text-left ${
          isAsap
            ? "border-ember bg-ember/5"
            : "border-gray-200 hover:border-ember/40"
        }`}
      >
        <span className="text-2xl">⚡</span>
        <div className="flex-1">
          <p
            className={`text-sm font-bold ${isAsap ? "text-ember" : "text-gray-700"}`}
          >
            Emergency / ASAP
          </p>
          <p className="text-xs text-gray-400">
            Groomers available within 45 minutes
          </p>
        </div>
        <div
          className={`w-10 h-5.5 rounded-full transition-colors relative ${isAsap ? "bg-ember" : "bg-gray-200"}`}
          style={{ height: "22px" }}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isAsap ? "left-[22px]" : "left-0.5"}`}
          />
        </div>
      </button>

      {/* CTA */}
      <button onClick={search} className="btn btn-forest btn-full btn-lg">
        🔍 {isAsap ? "Find available groomers" : "Browse groomers"}
      </button>

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
        <span>🛡️</span>
        <span>All groomers ID-verified · Payment protected</span>
      </div>
    </div>
  );
}
