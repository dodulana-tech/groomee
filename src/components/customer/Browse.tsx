"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Service, ProWithServices } from "@/types";
import { formatNaira, getServiceCategoryIcon } from "@/lib/utils";

interface Props {
  services: Service[];
  pros: ProWithServices[];
}

const CATEGORY_LABELS: Record<string, string> = {
  HAIR: "Hair",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  BARBING: "Barbing",
  LASHES: "Lashes",
  SKINCARE: "Skincare",
};

export default function Browse({ services, pros }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const categories = useMemo(
    () => [...new Set(services.map((s) => s.category))],
    [services],
  );

  const minPriceByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      const catServices = services.filter((s) => s.category === cat);
      map[cat] = Math.min(
        ...catServices.map((s) => s.minPrice ?? s.basePrice),
      );
    }
    return map;
  }, [categories, services]);

  const proCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      map[cat] = pros.filter((p) =>
        p.services.some((ps) => ps.service.category === cat),
      ).length;
    }
    return map;
  }, [categories, pros]);

  const filteredPros = useMemo(() => {
    if (activeCategory === "ALL") return pros;
    return pros.filter((p) =>
      p.services.some((ps) => ps.service.category === activeCategory),
    );
  }, [activeCategory, pros]);

  const seeAllHref =
    activeCategory === "ALL"
      ? "/search"
      : `/search?service=${
          services.find((s) => s.category === activeCategory)?.slug ?? ""
        }`;

  return (
    <section id="services" className="section bg-white">
      <div className="container">
        <div className="section-header">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
            Browse
          </p>
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Everything you need,
            <br />
            <span className="text-brand-600">at your doorstep</span>
          </h2>
          <p className="mt-4 max-w-lg text-base text-gray-500">
            Vetted pros across every service — pick a category to narrow the list.
          </p>
        </div>

        <div className="mb-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <CategoryChip
            active={activeCategory === "ALL"}
            onClick={() => setActiveCategory("ALL")}
            icon="✨"
            label="All"
            count={pros.length}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              icon={getServiceCategoryIcon(cat)}
              label={CATEGORY_LABELS[cat] ?? cat}
              count={proCountByCategory[cat] ?? 0}
            />
          ))}
        </div>

        {activeCategory !== "ALL" && minPriceByCategory[activeCategory] && (
          <p className="mb-6 text-sm text-gray-500">
            From{" "}
            <span className="font-bold text-gray-900">
              {formatNaira(minPriceByCategory[activeCategory])}
            </span>{" "}
            · {proCountByCategory[activeCategory] ?? 0} top-rated pros
          </p>
        )}

        {filteredPros.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
            <p className="text-sm text-gray-500">
              No top-rated pros yet in this category.
            </p>
            <Link
              href="/search"
              className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Browse all pros →
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {filteredPros.slice(0, 6).map((g) => {
              const firstService = g.services[0];
              const price = firstService
                ? (firstService.customPrice ?? firstService.service.basePrice)
                : 0;
              const isOnline = g.availability === "ONLINE";
              const mainCat = firstService?.service.category ?? "HAIR";

              return (
                <Link
                  key={g.id}
                  href={`/pro/${g.id}`}
                  className="card-hover flex min-w-[240px] shrink-0 flex-col overflow-hidden sm:min-w-0"
                >
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                    <span className="text-6xl opacity-80">
                      {getServiceCategoryIcon(mainCat)}
                    </span>
                    {isOnline && (
                      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-green-300" />
                        Available now
                      </div>
                    )}
                    {g.avgRating >= 4.8 && (
                      <div className="absolute right-3 top-3 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-extrabold text-yellow-900">
                        ⭐ Top rated
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{g.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {g.zones[0]?.zone.name ?? "Lagos"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-yellow-500">
                          ★ {g.avgRating > 0 ? g.avgRating.toFixed(1) : "New"}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          ({g.reviewCount})
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {g.services.slice(0, 3).map((gs) => (
                        <span
                          key={gs.service.name}
                          className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                        >
                          {gs.service.name}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          {formatNaira(price)}
                        </span>
                        <span className="text-xs text-gray-400"> from</span>
                      </div>
                      <span className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">
                        Book →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href={seeAllHref}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            See all pros →
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoryChip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
