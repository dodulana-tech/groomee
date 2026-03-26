"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import SearchFilters from "@/components/customer/SearchFilters";
import SearchHeader from "@/components/customer/SearchHeader";
import ProGrid from "@/components/customer/ProGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CATEGORY_CHIPS = [
  { label: "All services", value: null, emoji: "✨" },
  { label: "Hair", value: "knotless-braids", emoji: "💇🏿‍♀️" },
  { label: "Makeup", value: "full-glam-makeup", emoji: "💄" },
  { label: "Nails", value: "gel-nails", emoji: "💅🏿" },
  { label: "Barbing", value: "haircut-fade", emoji: "✂️" },
  { label: "Lashes", value: "classic-lashes", emoji: "👁️" },
  { label: "Skincare", value: "facial-glow", emoji: "✨" },
];

const SORT_OPTIONS = [
  { label: "Recommended", value: "recommended" },
  { label: "Highest rated", value: "rating" },
  { label: "Most reviewed", value: "reviews" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Price: high to low", value: "price_desc" },
];

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [pros, setPros] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [city, setCity] = useState<"Lagos" | "Abuja">("Lagos");

  const params = {
    service: searchParams.get("service") ?? undefined,
    zone: searchParams.get("zone") ?? undefined,
    asap: searchParams.get("asap") ?? undefined,
    rating: searchParams.get("rating") ?? undefined,
    minPrice: searchParams.get("minPrice") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      );
      if (sort !== "recommended") qp.set("sort", sort);
      const [gr, sv, zn] = await Promise.all([
        fetch(`/api/pros?${qp}`).then((r) => r.json()),
        fetch("/api/services").then((r) => r.json()),
        fetch("/api/zones").then((r) => r.json()),
      ]);
      setPros(gr.data ?? []);
      setServices(sv.data ?? []);
      // Filter zones by selected city
      const allZones: any[] = zn.data ?? [];
      setZones(allZones.filter((z: any) => z.city === city));
    } finally {
      setLoading(false);
    }
  }, [searchParams.toString(), sort, city]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeFiltersCount = [
    params.service,
    params.zone,
    params.asap,
    params.rating,
    params.minPrice || params.maxPrice ? "price" : undefined,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-cream-50 pb-24 lg:pb-8" style={{ paddingTop: 68 }}>
      {/* Search hero bar - glassmorphism */}
      <div className="border-b border-gray-200/50 bg-white/80 backdrop-blur-xl px-4 py-4 sm:px-6 sticky top-[68px] z-30">
        <div className="mx-auto max-w-7xl">
          {/* City selector */}
          <div className="flex items-center gap-2 mb-3">
            {(["Lagos", "Abuja"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold border-2 transition-all ${
                  city === c
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-200 hover:bg-brand-50"
                }`}
              >
                📍 {c}
              </button>
            ))}
          </div>

          {/* Abuja coming-soon banner */}
          {city === "Abuja" && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
              <span>
                <span className="font-bold">Coming soon to Abuja!</span> We're
                onboarding pros in FCT right now.
              </span>
              <Link
                href="/#waitlist"
                className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
              >
                Join waitlist
              </Link>
            </div>
          )}

          {/* Category chips - horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_CHIPS.map((chip) => {
              const isActive =
                params.service === chip.value ||
                (!params.service && !chip.value);
              return (
                <a
                  key={chip.label}
                  href={
                    chip.value ? `/search?service=${chip.value}` : "/search"
                  }
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:bg-brand-50"
                  }`}
                >
                  {chip.emoji} {chip.label}
                </a>
              );
            })}
          </div>

          {/* Filter bar + sort */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                ⚙️ Filters
                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              {params.asap && (
                <div className="flex items-center gap-1.5 rounded-full bg-accent-50 border border-accent/30 px-3 py-1.5 text-xs font-bold text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                  Emergency mode - showing available pros only
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 transition"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 hidden sm:block">
                {loading ? "..." : `${pros.length} found`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:flex lg:gap-8">
        {/* Sidebar filters - desktop with glass effect */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-40 glass rounded-2xl p-5 shadow-lg border border-white/20">
            <SearchFilters
              services={services}
              zones={zones}
              currentParams={params}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile filter drawer */}
          {showFilters && (
            <div className="lg:hidden mb-4 glass rounded-2xl p-5 shadow-lg border border-white/20 animate-fade-up">
              <SearchFilters
                services={services}
                zones={zones}
                currentParams={params}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )}

          <div className="mb-5">
            <SearchHeader total={pros.length} isAsap={!!params.asap} />
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden border border-white/20">
                  <div className="skeleton h-36 rounded-none" />
                  <div className="p-4 space-y-3">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-1/2" />
                    <div className="flex gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="skeleton h-5 w-16 rounded-lg" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ProGrid pros={pros} searchParams={params} />
          )}
        </main>
      </div>
    </div>
  );
}
