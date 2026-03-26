import Link from "next/link";
import { db } from "@/lib/db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Beauty Pros" };
export const revalidate = 0;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#DCFCE7", color: "#166534" },
  PENDING: { bg: "#FEF9C3", color: "#854D0E" },
  SUSPENDED: { bg: "#FEF2F2", color: "#991B1B" },
  REMOVED: { bg: "#F3F4F6", color: "#6B7280" },
};
const AVAIL_STYLE: Record<string, { bg: string; color: string }> = {
  ONLINE: { bg: "#DCFCE7", color: "#166534" },
  BUSY: { bg: "#FFF7ED", color: "#C2410C" },
  OFFLINE: { bg: "#F3F4F6", color: "#6B7280" },
};

export default async function AdminProsPage() {
  const pros = await db.pro.findMany({
    include: {
      services: {
        include: { service: { select: { name: true, category: true } } },
        take: 3,
      },
      zones: { include: { zone: { select: { name: true } } }, take: 2 },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beauty Pros</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pros.length} pros in system
          </p>
        </div>
        <Link
          href="/admin/pros/new"
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          + Add pro
        </Link>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {[
                  "Pro",
                  "Services",
                  "Zones",
                  "Status",
                  "Avail.",
                  "Rating",
                  "Jobs",
                  "Strikes",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pros.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No pros yet.
                  </td>
                </tr>
              )}
              {pros.map((g) => {
                const ss = STATUS_STYLE[g.status] ?? STATUS_STYLE.PENDING;
                const as = AVAIL_STYLE[g.availability] ?? AVAIL_STYLE.OFFLINE;
                return (
                  <tr
                    key={g.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{g.name}</p>
                      <p className="text-xs text-gray-400">{g.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.services.slice(0, 2).map((s) => (
                          <span
                            key={s.service.name}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                          >
                            {s.service.name}
                          </span>
                        ))}
                        {g.services.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{g.services.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {g.zones.map((z) => z.zone.name).join(", ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: as.bg, color: as.color }}
                      >
                        {g.availability}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {g.avgRating > 0 ? `★ ${g.avgRating.toFixed(1)}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {g._count.bookings}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold text-sm ${g.strikeCount > 0 ? "text-red-500" : "text-gray-400"}`}
                      >
                        {g.strikeCount}/3
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pros/${g.id}`}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg hover:opacity-80"
                        style={{ background: "#F0FDF4", color: "#166534" }}
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
