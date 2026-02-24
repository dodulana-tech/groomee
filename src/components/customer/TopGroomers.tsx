import Link from "next/link";
import { formatNaira } from "@/lib/utils";
import type { GroomerWithServices } from "@/types";

interface Props {
  groomers: GroomerWithServices[];
}

const EMOJI_MAP: Record<string, string> = {
  HAIR: "💇‍♀️",
  MAKEUP: "💄",
  NAILS: "💅",
  BARBING: "✂️",
  LASHES: "👁️",
  SKINCARE: "✨",
};

export default function TopGroomers({ groomers }: Props) {
  if (!groomers.length) return null;

  return (
    <section className="section-sm bg-gray-50">
      <div className="container">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-2">
              Top rated
            </p>
            <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              Our best groomers
            </h2>
          </div>
          <Link
            href="/search"
            className="hidden text-sm font-semibold text-brand-600 hover:text-brand-700 sm:block"
          >
            See all →
          </Link>
        </div>

        {/* Horizontal scroll on mobile */}
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
          {groomers.slice(0, 6).map((g) => {
            const firstService = g.services[0];
            const price = firstService
              ? (firstService.customPrice ?? firstService.service.basePrice)
              : 0;
            const isOnline = g.availability === "ONLINE";
            const mainCat = firstService?.service.category ?? "HAIR";

            return (
              <Link
                key={g.id}
                href={`/groomer/${g.id}`}
                className="card-hover flex min-w-[240px] shrink-0 flex-col overflow-hidden sm:min-w-0"
              >
                {/* Photo placeholder */}
                <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                  <span className="text-6xl opacity-80">
                    {EMOJI_MAP[mainCat] ?? "💆"}
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

                {/* Info */}
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

                  {/* Service tags */}
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

                  {/* Price + CTA */}
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

        <div className="mt-6 text-center sm:hidden">
          <Link href="/search" className="btn-secondary btn-sm">
            See all groomers →
          </Link>
        </div>
      </div>
    </section>
  );
}
