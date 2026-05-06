import Link from "next/link";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Beauty Pros" };
export const revalidate = 0;

const PAGE_SIZE = 50;

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

const STATUS_TABS = ["", "ACTIVE", "PENDING", "SUSPENDED", "REMOVED"];

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
  }>;
}

function buildQuery(params: { status?: string; q?: string }) {
  const out = new URLSearchParams();
  if (params.status) out.set("status", params.status);
  if (params.q) out.set("q", params.q);
  return out.toString();
}

export default async function AdminProsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const where: Prisma.ProWhereInput = {};
  if (status && STATUS_TABS.includes(status)) {
    where.status = status as never;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { bio: { contains: q, mode: "insensitive" } },
    ];
  }

  const [pros, total] = await Promise.all([
    db.pro.findMany({
      where,
      include: {
        services: {
          include: { service: { select: { name: true, category: true } } },
          take: 3,
        },
        zones: { include: { zone: { select: { name: true } } }, take: 2 },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.pro.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQs = buildQuery({ status, q });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beauty Pros</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} total · showing {pros.length} (page {page} of {totalPages})
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

      {/* Search */}
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, phone, bio…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
        >
          Search
        </button>
        {q && (
          <Link
            href={status ? `/admin/pros?status=${status}` : "/admin/pros"}
            className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Status tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((s) => {
          const tabQs = buildQuery({ status: s, q });
          const active = s === (status ?? "");
          return (
            <Link
              key={s || "all"}
              href={tabQs ? `/admin/pros?${tabQs}` : "/admin/pros"}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {s || "All"}
            </Link>
          );
        })}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Pro", "Services", "Zones", "Status", "Avail.", "Rating", "Jobs", "Strikes", ""].map((h) => (
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
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No pros found.
                  </td>
                </tr>
              )}
              {pros.map((g) => {
                const ss = STATUS_STYLE[g.status] ?? STATUS_STYLE.PENDING;
                const as = AVAIL_STYLE[g.availability] ?? AVAIL_STYLE.OFFLINE;
                return (
                  <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
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
                    <td className="px-4 py-3 text-gray-600">{g._count.bookings}</td>
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={page > 1 ? `/admin/pros?${baseQs}${baseQs ? "&" : ""}page=${page - 1}` : "#"}
            aria-disabled={page <= 1}
            className={cn(
              "rounded-xl px-4 py-2 font-semibold border border-gray-200",
              page <= 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            ← Previous
          </Link>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={page < totalPages ? `/admin/pros?${baseQs}${baseQs ? "&" : ""}page=${page + 1}` : "#"}
            aria-disabled={page >= totalPages}
            className={cn(
              "rounded-xl px-4 py-2 font-semibold border border-gray-200",
              page >= totalPages
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
