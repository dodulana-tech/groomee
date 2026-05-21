import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import WithdrawalRowActions from "./WithdrawalRowActions";
import type { Metadata } from "next";
import type { Prisma, SavingsWithdrawalStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Reserve withdrawals · Admin" };
export const revalidate = 0;

const STATUS_TABS = [
  { label: "Pending", value: "PENDING" },
  { label: "Eligible", value: "ELIGIBLE" },
  { label: "Paid", value: "PAID" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Failed", value: "FAILED" },
  { label: "All", value: "" },
];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "#FEF9C3", color: "#854D0E" },
  ELIGIBLE: { bg: "#DBEAFE", color: "#1E40AF" },
  PAID: { bg: "#DCFCE7", color: "#166534" },
  CANCELLED: { bg: "#F3F4F6", color: "#4B5563" },
  FAILED: { bg: "#FEF2F2", color: "#991B1B" },
};

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function WithdrawalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status ?? "PENDING";

  const where: Prisma.SavingsWithdrawalWhereInput = {};
  if (status && ["PENDING", "ELIGIBLE", "PAID", "CANCELLED", "FAILED"].includes(status)) {
    where.status = status as SavingsWithdrawalStatus;
  }

  const [rows, summary] = await Promise.all([
    db.savingsWithdrawal.findMany({
      where,
      include: { pro: { select: { id: true, name: true, phone: true, bankName: true, bankAccount: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.savingsWithdrawal.groupBy({
      by: ["status"],
      _sum: { amount: true, netAmount: true },
      _count: { _all: true },
    }),
  ]);

  const summaryMap = Object.fromEntries(
    summary.map((s) => [s.status, { count: s._count._all, amount: s._sum.amount ?? 0, net: s._sum.netAmount ?? 0 }]),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/savings" className="text-xs text-gray-400 hover:underline">← Overview</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Reserve withdrawals</h1>
          <p className="text-sm text-gray-500">Notice-period queue. Instant-break withdrawals also appear here for release.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {(["PENDING", "ELIGIBLE", "PAID", "CANCELLED", "FAILED"] as const).map((s) => (
          <div key={s} className="glass-card rounded-2xl p-3">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{summaryMap[s]?.count ?? 0}</p>
            <p className="text-xs text-gray-500">{formatNaira(summaryMap[s]?.amount ?? 0)} gross</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = (tab.value || "ALL") === (status || "ALL");
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/admin/savings/withdrawals?status=${tab.value}` : "/admin/savings/withdrawals?status="}
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
            <p className="text-3xl mb-2">📥</p>
            <p>No withdrawals in this view.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Pro", "Type", "Gross", "Net", "Status", "Eligible", "Bank", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((w) => {
                const badge = STATUS_BADGE[w.status] ?? STATUS_BADGE.PENDING;
                const bankReady = Boolean(w.pro.bankAccount && w.pro.bankName);
                return (
                  <tr key={w.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/savings/accounts/${w.pro.id}`} className="font-medium text-gray-900 hover:underline">
                        {w.pro.name}
                      </Link>
                      <p className="text-xs text-gray-400">{w.pro.phone}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {w.isInstant ? (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-bold">INSTANT</span>
                      ) : (
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-bold">NOTICE</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatNaira(w.amount)}</td>
                    <td className="px-3 py-2 font-bold text-gray-900">{formatNaira(w.netAmount)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: badge.bg, color: badge.color }}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {w.noticeUntil ? format(new Date(w.noticeUntil), "dd MMM HH:mm") : w.isInstant ? "Instant" : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {bankReady ? w.pro.bankName : <span className="text-red-500 font-medium">⚠ Missing</span>}
                    </td>
                    <td className="px-3 py-2">
                      <WithdrawalRowActions withdrawalId={w.id} status={w.status} bankReady={bankReady} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
