import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProCardData {
  id: string;
  name: string;
  slug: string;
  initials: string;
  headline: string;
  specialties: string[];
  zones: string[];
  avgRating: number;
  reviewCount: number;
  totalJobs: number;
  isOnline: boolean;
  isVerified: boolean;
  baseRate: number;
}

export default function ProCard({
  pro,
  compact = false,
}: {
  pro: ProCardData;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/pro/${pro.slug}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 flex flex-col"
    >
      {/* Avatar area */}
      <div className="relative h-40 bg-gradient-to-br from-forest-50 via-cream-100 to-amber-50 flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-forest-400 flex items-center justify-center text-white font-display font-black text-3xl shadow-lg">
          {pro.initials}
        </div>
        {/* Online indicator */}
        <div
          className={cn(
            "absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
            pro.isOnline
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              pro.isOnline
                ? "bg-emerald-500 animate-pulse-dot"
                : "bg-gray-400",
            )}
          />
          {pro.isOnline ? "Online" : "Offline"}
        </div>
        {/* Verified badge */}
        {pro.isVerified && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-forest-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
            ✓ Verified
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-base text-ink group-hover:text-forest-500 transition-colors leading-tight">
            {pro.name}
          </h3>
          <div className="flex items-center gap-1 text-amber-500 text-sm font-bold shrink-0">
            ★ {pro.avgRating}
          </div>
        </div>
        <p className="text-gray-500 text-xs leading-snug mb-3 line-clamp-2">
          {pro.headline}
        </p>

        {/* Zones */}
        <div className="flex flex-wrap gap-1 mb-3">
          {pro.zones.slice(0, 2).map((z) => (
            <span
              key={z}
              className="bg-forest-50 text-forest-600 text-xs px-2 py-0.5 rounded-full font-medium"
            >
              {z}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <span className="font-bold text-sm text-ink">
              From ₦{pro.baseRate.toLocaleString()}
            </span>
            <p className="text-gray-400 text-xs">
              {pro.reviewCount} reviews
            </p>
          </div>
          <span className="text-forest-500 text-sm font-semibold group-hover:translate-x-1 transition-transform">
            Book →
          </span>
        </div>
      </div>
    </Link>
  );
}
