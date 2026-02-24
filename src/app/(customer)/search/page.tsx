"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import SearchFilters from "@/components/customer/SearchFilters";
import SearchHeader from "@/components/customer/SearchHeader";
import GroomerGrid from "@/components/customer/GroomerGrid";

export const dynamic = "force-dynamic";

// Filter chip data
const CATEGORY_CHIPS = [
  { label: "All services", value: null, emoji: "✨" },
  { label: "Hair", value: "knotless-braids", emoji: "💇‍♀️" },
  { label: "Makeup", value: "full-glam-makeup", emoji: "💄" },
  { label: "Nails", value: "gel-nails", emoji: "💅" },
  { label: "Barbing", value: "haircut-fade", emoji: "✂️" },
  { label: "Lashes", value: "classic-lashes", emoji: "👁️" },
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
  const [groomers, setGroomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const params = {
    service: searchParams.get("service") ?? undefined,
    zone: searchParams.get("zone") ?? undefined,
    asap: searchParams.get("asap") ?? undefined,
    rating: searchParams.get("rating") ?? undefined,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      );
      const [gr, sv, zn] = await Promise.all([
        fetch(`/api/groomers?${qp}`).then((r) => r.json()),
        fetch("/api/services").then((r) => r.json()),
        fetch("/api/admin/zones").then((r) => r.json()),
      ]);
      setGroomers(gr.data ?? []);
      setServices(sv.data ?? []);
      setZones(zn.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [searchParams.toString()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeFiltersCount = [
    params.service,
    params.zone,
    params.asap,
    params.rating,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-8">
      {/* Search hero bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Category chips — horizontal scroll */}
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
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {chip.emoji} {chip.label}
                </a>
              );
            })}
          </div>

          {/* Filter bar */}
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
                  Emergency mode
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {loading ? "..." : `${groomers.length} found`}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:flex lg:gap-8">
        {/* Sidebar filters — desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 card p-5">
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
            <div className="lg:hidden mb-4 card p-5 animate-fade-up">
              <SearchFilters
                services={services}
                zones={zones}
                currentParams={params}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )}

          <div className="mb-5">
            <SearchHeader total={groomers.length} isAsap={!!params.asap} />
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card overflow-hidden">
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
            <GroomerGrid groomers={groomers} searchParams={params} />
          )}
        </main>
      </div>
    </div>
  );
}
