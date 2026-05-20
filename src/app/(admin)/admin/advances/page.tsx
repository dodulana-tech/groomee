import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import AdvanceActions from "./AdvanceActions";
import RepayClient from "./RepayClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pro Advances" };
export const revalidate = 0;

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Repaid", value: "REPAID" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" },
];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "#FEF9C3", color: "#854D0E" },
  APPROVED: { bg: "#DBEAFE", color: "#1E40AF" },
  REPAID: { bg: "#DCFCE7", color: "#166534" },
  REJECTED: { bg: "#FEF2F2", color: "#991B1B" },
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdvancesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status ?? "PENDING";
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const where: { status?: string } = {};
  if (status) where.status = status;

  const [rows, total, summary] = await Promise.all([
    db.proAdvance.findMany({
      where,
      include: {
        pro: {
          select: { id: true, name: true, phone: true, bankName: true, bankAccount: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.proAdvance.count({ where }),
    db.proAdvance.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summaryMap = Object.fromEntries(
    summary.map((s) => [s.status, { count: s._count._all, total: s._sum.amount ?? 0 }]),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pro Advances</h1>
        <p className="mt-1 text-sm text-gray-500">
          Early payout requests from pros — repaid via deductions on weekly payouts.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        {(["PENDING", "APPROVED", "REPAID", "REJECTED"] as const).map((s) => (
          <div key={s} className="glass-card rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summaryMap[s]?.count ?? 0}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatNaira(summaryMap[s]?.total ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = (tab.value || "ALL") === (status || "ALL");
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/admin/advances?status=${tab.value}` : "/admin/advances?status="}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">💸</p>
            <p>No advance requests in this view.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Pro", "Amount", "Reason", "Bank", "Status", "When", ""].map((h) => (
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
              {rows.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.PENDING;
                const bankReady = Boolean(r.pro.bankAccount && r.pro.bankName);
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pros/${r.pro.id}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {r.pro.name}
                      </Link>
                      <p className="text-xs text-gray-400">{r.pro.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatNaira(r.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                      <p className="truncate text-sm" title={r.reason}>{r.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {bankReady ? (
                        `${r.pro.bankName}`
                      ) : (
                        <span className="text-red-500 font-medium">⚠ Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(r.createdAt), "dd MMM, HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "PENDING" && (
                        <AdvanceActions
                          advanceId={r.id}
                          proName={r.pro.name}
                          amount={r.amount}
                        />
                      )}
                      {r.status === "APPROVED" && (
                        <RepayClient advanceId={r.id} amount={r.amount} />
                      )}
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
            href={
              page > 1
                ? `/admin/advances?status=${status}&page=${page - 1}`
                : "#"
            }
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
            href={
              page < totalPages
                ? `/admin/advances?status=${status}&page=${page + 1}`
                : "#"
            }
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

