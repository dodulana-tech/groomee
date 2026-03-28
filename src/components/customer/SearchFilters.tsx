"use client";

import { useRouter, usePathname } from "next/navigation";
import { getServiceCategoryIcon } from "@/lib/utils";

const PRICE_RANGES = [
  { label: "Under ₦10,000", minPrice: null, maxPrice: "10000" },
  { label: "₦10,000 – ₦20,000", minPrice: "10000", maxPrice: "20000" },
  { label: "₦20,000 – ₦50,000", minPrice: "20000", maxPrice: "50000" },
  { label: "₦50,000+", minPrice: "50000", maxPrice: null },
];

interface Props {
  services: Array<{ id: string; name: string; slug: string; category: string }>;
  zones: Array<{ id: string; name: string; slug: string }>;
  currentParams: Record<string, string | undefined>;
  onClose?: () => void;
}

export default function SearchFilters({
  services,
  zones,
  currentParams,
  onClose,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(
      Object.entries(currentParams)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, v!]),
    );
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
    onClose?.();
  }

  function updatePriceRange(minPrice: string | null, maxPrice: string | null) {
    const params = new URLSearchParams(
      Object.entries(currentParams)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, v!]),
    );
    params.delete("minPrice");
    params.delete("maxPrice");
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    router.push(`${pathname}?${params.toString()}`);
    onClose?.();
  }

  const activePriceRange = PRICE_RANGES.find(
    (r) =>
      (r.minPrice ?? undefined) === currentParams.minPrice &&
      (r.maxPrice ?? undefined) === currentParams.maxPrice,
  );

  const categories = [...new Set(services.map((s) => s.category))];
  const hasFilters = Object.values(currentParams).some(Boolean);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-base">Filters</h3>
        {hasFilters && (
          <button
            onClick={() => {
              router.push(pathname);
              onClose?.();
            }}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Availability */}
      <div>
        <p className="input-label mb-3">Availability</p>
        <label className="flex cursor-pointer items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={!!currentParams.asap}
            aria-label="Available now filter"
            onClick={() => update("asap", currentParams.asap ? null : "true")}
            className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${currentParams.asap ? "bg-brand-600" : "bg-gray-200"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${currentParams.asap ? "left-[18px]" : "left-0.5"}`}
            />
          </button>
          <div>
            <p className="font-semibold text-gray-800">Available now</p>
            <p className="text-xs text-gray-500">Online and ready to book</p>
          </div>
        </label>
      </div>

      {/* Service category */}
      <div>
        <p className="input-label mb-3">Service</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category === cat);
            const isSelected = catServices.some(
              (s) => s.slug === currentParams.service,
            );
            const firstSlug = catServices[0]?.slug;
            return (
              <button
                key={cat}
                onClick={() =>
                  update("service", isSelected ? null : (firstSlug ?? null))
                }
                className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"
                }`}
              >
                <span>{getServiceCategoryIcon(cat)}</span>
                <span className="font-semibold">
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </span>
                <span className="ml-auto text-[10px] font-bold text-gray-400">
                  {catServices.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone */}
      <div>
        <p className="input-label mb-3">Zone</p>
        <div className="flex flex-col gap-1.5">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() =>
                update(
                  "zone",
                  currentParams.zone === zone.slug ? null : zone.slug,
                )
              }
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                currentParams.zone === zone.slug
                  ? "border-brand-500 bg-brand-50 font-bold text-brand-700"
                  : "border-transparent bg-gray-50 text-gray-700 hover:border-gray-200"
              }`}
            >
              <span>📍</span>
              {zone.name}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <p className="input-label mb-3">Min rating</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "4.5+ ★", value: "4.5", sub: "Excellent" },
            { label: "4.0+ ★", value: "4.0", sub: "Very good" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                update(
                  "rating",
                  currentParams.rating === opt.value ? null : opt.value,
                )
              }
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                currentParams.rating === opt.value
                  ? "border-yellow-400 bg-yellow-50 font-bold text-yellow-700"
                  : "border-transparent bg-gray-50 text-gray-700 hover:border-gray-200"
              }`}
            >
              <span className="text-yellow-500 font-bold">{opt.label}</span>
              <span className="text-xs text-gray-500">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="input-label mb-3">Price range</p>
        <div className="flex flex-col gap-1.5">
          {PRICE_RANGES.map((range) => {
            const isSelected =
              (range.minPrice ?? undefined) === currentParams.minPrice &&
              (range.maxPrice ?? undefined) === currentParams.maxPrice;
            return (
              <button
                key={range.label}
                onClick={() =>
                  isSelected
                    ? updatePriceRange(null, null)
                    : updatePriceRange(range.minPrice, range.maxPrice)
                }
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-50 font-bold text-brand-700"
                    : "border-transparent bg-gray-50 text-gray-700 hover:border-gray-200"
                }`}
              >
                <span>💳</span>
                {range.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
