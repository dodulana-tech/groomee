import { formatNaira, getServiceCategoryIcon } from "@/lib/utils";
import type { Service } from "@/types";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  booking: {
    customer: { name: string | null };
    service: Service;
  };
}

interface GroomerServiceRow {
  service: Service;
  customPrice: number | null;
}

interface Zone {
  zone: { name: string };
}

interface Props {
  groomer: {
    id: string;
    name: string;
    bio: string | null;
    avgRating: number;
    reviewCount: number;
    totalJobs: number;
    availability: string;
    services: GroomerServiceRow[];
    zones: Zone[];
    reviews: Review[];
  };
}

export default function GroomerProfile({ groomer }: Props) {
  const servicesByCategory = groomer.services.reduce<
    Record<string, GroomerServiceRow[]>
  >((acc, gs) => {
    const cat = gs.service.category;
    acc[cat] = [...(acc[cat] ?? []), gs];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-4xl lg:h-24 lg:w-24">
            💇
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs text-white font-bold">
              ✓
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-gray-900 lg:text-3xl">
              {groomer.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {groomer.zones.slice(0, 3).map((z) => (
                <span
                  key={z.zone.name}
                  className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
                >
                  📍 {z.zone.name}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-5 text-sm">
              <div className="text-center">
                <p className="text-xl font-extrabold text-gray-900">
                  ★ {groomer.avgRating.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400">
                  {groomer.reviewCount} reviews
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-extrabold text-gray-900">
                  {groomer.totalJobs}+
                </p>
                <p className="text-xs text-gray-400">Jobs done</p>
              </div>
              <div className="text-center">
                <p
                  className={`text-xl font-extrabold ${groomer.availability === "ONLINE" ? "text-brand-600" : "text-gray-400"}`}
                >
                  {groomer.availability === "ONLINE" ? "●" : "○"}
                </p>
                <p className="text-xs text-gray-400">
                  {groomer.availability === "ONLINE"
                    ? "Available now"
                    : "Offline"}
                </p>
              </div>
            </div>
          </div>
        </div>
        {groomer.bio && (
          <p className="mt-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
            {groomer.bio}
          </p>
        )}
      </div>

      {/* Services */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Services & Pricing</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            * Base prices shown · surcharges may apply
          </p>
        </div>
        {Object.entries(servicesByCategory).map(([cat, services]) => (
          <div key={cat}>
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                {getServiceCategoryIcon(cat)}{" "}
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {services.map(({ service, customPrice }) => (
                  <tr key={service.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {service.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-gray-400">
                      ~
                      {service.durationMins >= 60
                        ? `${Math.floor(service.durationMins / 60)}h${service.durationMins % 60 ? ` ${service.durationMins % 60}m` : ""}`
                        : `${service.durationMins}m`}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">
                        {formatNaira(customPrice ?? service.basePrice)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Reviews */}
      {groomer.reviews.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-900">
            Reviews ({groomer.reviewCount})
          </h2>
          <div className="space-y-4">
            {groomer.reviews.map((review) => (
              <div key={review.id} className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm">
                      👤
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {review.booking.customer.name ?? "Customer"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {review.booking.service.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-bold text-sm">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
