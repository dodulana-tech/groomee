import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import SubscriptionActions from "./SubscriptionActions";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Subscriptions" };
export const revalidate = 0;

const PAGE_SIZE = 50;

const STATUS_TABS = ["", "ACTIVE", "PENDING", "PAST_DUE", "CANCELLED", "EXPIRED"];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#DCFCE7", color: "#166534" },
  PENDING: { bg: "#FEF9C3", color: "#854D0E" },
  PAST_DUE: { bg: "#FFF7ED", color: "#C2410C" },
  CANCELLED: { bg: "#F3F4F6", color: "#6B7280" },
  EXPIRED: { bg: "#FEF2F2", color: "#991B1B" },
};

interface Props {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

function buildQuery(params: { status?: string; q?: string }) {
  const out = new URLSearchParams();
  if (params.status) out.set("status", params.status);
  if (params.q) out.set("q", params.q);
  return out.toString();
}

export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const where: Prisma.SubscriptionWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [rows, total, plans, summary] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        plan: { select: { id: true, name: true, price: true, credits: true } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.subscription.count({ where }),
    db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQs = buildQuery({ status, q });
  const summaryMap = Object.fromEntries(summary.map((s) => [s.status, s._count._all]));

  const activeMrr = await db.subscription.aggregate({
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Groomee Pass plans and recurring revenue · {total} total subscriptions
        </p>
      </div>

      {/* Plan summary */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Active</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summaryMap.ACTIVE ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">{activeMrr._count._all} subscribers</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Past due</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summaryMap.PAST_DUE ?? 0}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Cancelled</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{summaryMap.CANCELLED ?? 0}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Plans</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{plans.length}</p>
        </div>
      </div>

      {/* Plans list */}
      {plans.length > 0 && (
        <div className="glass-card rounded-2xl p-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-2">Plans</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.credits} credits · {formatNaira(p.price)}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {p._count.subscriptions} subs
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Search subscriber
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, phone, email…"
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
            href={status ? `/admin/subscriptions?status=${status}` : "/admin/subscriptions"}
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
              href={tabQs ? `/admin/subscriptions?${tabQs}` : "/admin/subscriptions"}
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
        {rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p>No subscriptions in this view.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Subscriber", "Plan", "Status", "Credits", "Renews", "Started", ""].map((h) => (
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
              {rows.map((s) => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.PENDING;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${s.user.id}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {s.user.name ?? "Unnamed"}
                      </Link>
                      <p className="text-xs text-gray-400">{s.user.phone ?? s.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{s.plan.name}</p>
                      <p className="text-xs text-gray-400">{formatNaira(s.plan.price)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="font-bold">{s.creditsRemaining}</span>
                      <span className="text-gray-400"> / {s.creditsTotal}</span>
                      <p className="text-xs text-gray-400">{s._count.usages} used</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(new Date(s.nextBillingDate), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(new Date(s.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionActions
                        subscriptionId={s.id}
                        status={s.status}
                        creditsRemaining={s.creditsRemaining}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={page > 1 ? `/admin/subscriptions?${baseQs}${baseQs ? "&" : ""}page=${page - 1}` : "#"}
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
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <Link
            href={page < totalPages ? `/admin/subscriptions?${baseQs}${baseQs ? "&" : ""}page=${page + 1}` : "#"}
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
