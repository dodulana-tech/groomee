import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const revalidate = 0;

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACCEPT: "bg-amber-50 text-amber-700",
  IN_TRAINING: "bg-blue-50 text-blue-700",
  READY_FOR_FREEDOM: "bg-green-50 text-green-700",
  FREED: "bg-purple-50 text-purple-700",
  TERMINATED: "bg-red-50 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPT: "Pending accept",
  IN_TRAINING: "In training",
  READY_FOR_FREEDOM: "Ready for Freedom",
  FREED: "Freed",
  TERMINATED: "Terminated",
};

const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Pending accept", value: "PENDING_ACCEPT" },
  { label: "In training", value: "IN_TRAINING" },
  { label: "Ready for Freedom", value: "READY_FOR_FREEDOM" },
  { label: "Freed", value: "FREED" },
  { label: "Terminated", value: "TERMINATED" },
];

function buildQuery(p: { status?: string; masterId?: string; q?: string }) {
  const out = new URLSearchParams();
  if (p.status) out.set("status", p.status);
  if (p.masterId) out.set("masterId", p.masterId);
  if (p.q) out.set("q", p.q);
  return out.toString();
}

interface Props {
  searchParams: Promise<{
    status?: string;
    masterId?: string;
    q?: string;
  }>;
}

export default async function AdminApprenticeshipsPage({ searchParams }: Props) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.view)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const status = sp.status?.trim();
  const masterId = sp.masterId?.trim();
  const q = sp.q?.trim();

  const where: Prisma.ApprenticeshipWhereInput = {};
  if (status && STATUS_LABEL[status]) {
    where.status = status as never;
  }
  if (masterId) {
    where.masterId = masterId;
  }
  if (q) {
    where.OR = [
      { apprentice: { name: { contains: q, mode: "insensitive" } } },
      { apprentice: { phone: { contains: q } } },
    ];
  }

  // Always compute counts across the whole table (don't filter by status here
  // so the status pill counts stay stable as the user filters).
  const [apprenticeships, statusGroups, masters] = await Promise.all([
    db.apprenticeship.findMany({
      where,
      orderBy: { invitedAt: "desc" },
      include: {
        apprentice: {
          select: {
            id: true,
            name: true,
            phone: true,
            totalJobs: true,
            avgRating: true,
          },
        },
        master: { select: { id: true, name: true, phone: true } },
        _count: { select: { modules: true } },
      },
    }),
    db.apprenticeship.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.pro.findMany({
      where: { apprenticeshipsAsMaster: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of statusGroups) counts[g.status] = g._count._all;

  const baseQs = buildQuery({ status, masterId, q });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Apprenticeships</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Track every master ↔ apprentice relationship across the network.
        </p>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.keys(STATUS_LABEL).map((s) => (
          <div key={s} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {STATUS_LABEL[s]}
            </p>
            <p className="text-2xl font-black text-gray-900 mt-1">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Search apprentice
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Apprentice name or phone…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Master
          </label>
          <select
            name="masterId"
            defaultValue={masterId ?? ""}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option value="">All masters</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
        >
          Apply
        </button>
        {(q || masterId) && (
          <Link
            href={status ? `/admin/apprenticeships?status=${status}` : "/admin/apprenticeships"}
            className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const tabQs = buildQuery({ status: tab.value, masterId, q });
          const active =
            (tab.value === "" && !status) || status === tab.value;
          return (
            <Link
              key={tab.label}
              href={tabQs ? `/admin/apprenticeships?${tabQs}` : "/admin/apprenticeships"}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Apprentice</th>
              <th className="px-4 py-3">Master</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Master cut</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Jobs</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apprenticeships.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  {baseQs
                    ? "No apprenticeships match the current filters."
                    : "No apprenticeships yet. Masters will create them from the partner portal."}
                </td>
              </tr>
            )}
            {apprenticeships.map((a) => (
              <tr
                key={a.id}
                className="border-t border-gray-100 hover:bg-gray-50/50"
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{a.apprentice.name}</div>
                  <div className="text-xs text-gray-400">{a.apprentice.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.master.name}</div>
                  <div className="text-xs text-gray-400">{a.master.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status]}`}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {(a.masterCommission * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {a._count.modules} module{a._count.modules === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-gray-700">{a.apprentice.totalJobs}</td>
                <td className="px-4 py-3 text-gray-700">
                  {a.apprentice.avgRating.toFixed(1)} ★
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {a.acceptedAt
                    ? new Date(a.acceptedAt).toLocaleDateString("en-NG")
                    : `Invited ${new Date(a.invitedAt).toLocaleDateString("en-NG")}`}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/apprenticeships/${a.id}`}
                    className="text-xs font-bold text-brand-600 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
