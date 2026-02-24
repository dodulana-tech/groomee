import Link from "next/link";
import { formatNaira } from "@/lib/utils";

const EMOJI_MAP: Record<string, string> = {
  HAIR: "💇‍♀️",
  MAKEUP: "💄",
  NAILS: "💅",
  BARBING: "✂️",
  LASHES: "👁️",
  SKINCARE: "✨",
};
const BG_MAP: Record<string, string> = {
  HAIR: "from-brand-50 to-brand-100",
  MAKEUP: "from-pink-50 to-pink-100",
  NAILS: "from-purple-50 to-purple-100",
  BARBING: "from-blue-50 to-blue-100",
  LASHES: "from-rose-50 to-rose-100",
  SKINCARE: "from-amber-50 to-amber-100",
};

interface Props {
  groomers: Array<{
    id: string;
    name: string;
    availability: string;
    avgRating: number;
    reviewCount: number;
    totalJobs: number;
    services: Array<{
      service: { name: string; basePrice: number; category: string };
      customPrice: number | null;
    }>;
    zones: Array<{ zone: { name: string } }>;
  }>;
  searchParams: { service?: string };
}

export default function GroomerGrid({ groomers, searchParams }: Props) {
  if (groomers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
        <span className="mb-4 text-5xl">🔍</span>
        <p className="font-bold text-gray-700 text-lg">No groomers found</p>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          Try removing filters or searching in a different zone. More groomers
          are being added daily.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groomers.map((groomer) => {
        const firstService = groomer.services[0];
        const price = firstService
          ? (firstService.customPrice ?? firstService.service.basePrice)
          : 0;
        const isOnline = groomer.availability === "ONLINE";
        const mainCat = firstService?.service.category ?? "HAIR";
        const href = `/groomer/${groomer.id}${searchParams.service ? `?service=${searchParams.service}` : ""}`;

        return (
          <Link
            key={groomer.id}
            href={href}
            className="group card-hover flex flex-col overflow-hidden"
          >
            {/* Photo area */}
            <div
              className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${BG_MAP[mainCat] ?? "from-gray-50 to-gray-100"}`}
            >
              <span className="text-6xl transition-transform duration-300 group-hover:scale-110">
                {EMOJI_MAP[mainCat] ?? "💆"}
              </span>

              {isOnline && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-green-300" />
                  Available now
                </div>
              )}
              {groomer.avgRating >= 4.8 && (
                <div className="absolute right-3 top-3 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-extrabold text-yellow-900">
                  ⭐ Top rated
                </div>
              )}

              {/* Jobs badge */}
              {groomer.totalJobs > 0 && (
                <div className="absolute bottom-2 right-2 rounded-lg bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  {groomer.totalJobs} jobs done
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-700 transition-colors">
                    {groomer.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-1">
                    <span>📍</span> {groomer.zones[0]?.zone.name ?? "Lagos"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-yellow-500">
                    ★{" "}
                    {groomer.avgRating > 0
                      ? groomer.avgRating.toFixed(1)
                      : "New"}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {groomer.reviewCount} reviews
                  </p>
                </div>
              </div>

              {/* Service tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {groomer.services.slice(0, 3).map((gs) => (
                  <span
                    key={gs.service.name}
                    className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600"
                  >
                    {gs.service.name}
                  </span>
                ))}
                {groomer.services.length > 3 && (
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-400">
                    +{groomer.services.length - 3}
                  </span>
                )}
              </div>

              {/* Price row */}
              <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                <div>
                  <span className="font-bold text-gray-900">
                    {formatNaira(price)}
                  </span>
                  <span className="text-xs text-gray-400"> from</span>
                </div>
                <span className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition-all group-hover:bg-brand-700 group-hover:shadow-green">
                  Book now →
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
