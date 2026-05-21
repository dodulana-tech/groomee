import Link from "next/link";
import { db } from "@/lib/db";
import { getOverview } from "@/lib/savings";
import { formatNaira } from "@/lib/utils";
import { format } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Earnings Reserve · Admin" };
export const revalidate = 0;

export default async function SavingsOverviewPage() {
  const [overview, recentMovements] = await Promise.all([
    getOverview(),
    db.savingsMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { pro: { select: { id: true, name: true } } },
    }),
  ]);

  const stats = [
    { label: "Total locked", value: formatNaira(overview.totalLocked), hint: "Within clawback window" },
    { label: "Total available", value: formatNaira(overview.totalAvailable), hint: "Withdrawable now" },
    { label: "Pending withdrawals", value: formatNaira(overview.totalPendingWd), hint: "Reserved on open requests" },
    { label: "Lifetime withdrawn", value: formatNaira(overview.totalWithdrawn) },
    { label: "Pros opted in", value: `${overview.optInCount} / ${overview.totalProCount}`, hint: `${overview.optInPct}%` },
    { label: "Skimmed (7d)", value: formatNaira(overview.skimmedLast7d) },
    { label: "Clawed back (7d)", value: formatNaira(overview.clawedBackLast7d) },
    { label: "Withdrawals waiting", value: `${overview.pendingWithdrawalCount} pending · ${overview.eligibleWithdrawalCount} eligible` },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings Reserve</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pros opt in to skim a percent of every confirmed booking into a vault. Withdraw after notice, or break instantly with penalty.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/savings/accounts" className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200">
            Accounts
          </Link>
          <Link href="/admin/savings/withdrawals" className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200">
            Withdrawals
          </Link>
          <a
            href="/api/admin/savings/movements.csv"
            className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200"
          >
            Export CSV
          </a>
          <Link href="/admin/savings/config" className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Config
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            {s.hint && <p className="text-xs text-gray-500 mt-0.5">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Recent Reserve activity</h2>
            <Link href="/admin/savings/accounts" className="text-xs text-brand-600 hover:underline">
              All accounts →
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-3xl mb-2">🏦</p>
              <p>No Reserve activity yet. Once pros opt in, every confirmed booking will skim a slice into the vault.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  {["When", "Pro", "Type", "Amount", "Balance after", "Note"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{format(new Date(m.createdAt), "dd MMM HH:mm")}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/savings/accounts/${m.proId}`} className="text-gray-900 font-medium hover:underline">
                        {m.pro?.name ?? m.proId.slice(0, 6)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{m.type}</span>
                    </td>
                    <td className={`px-3 py-2 font-bold ${m.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {m.amount >= 0 ? "+" : ""}{formatNaira(m.amount)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatNaira(m.balanceAfter)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[280px] truncate" title={m.note ?? ""}>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Trust posture</h2>
          <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
            <li>Default rate <strong>5%</strong> of pro earning. Slider 2–15%.</li>
            <li><strong>Opt-in only</strong> — never default ON.</li>
            <li><strong>72hr clawback</strong> window for refunded bookings. After: vault is final.</li>
            <li><strong>14-day notice</strong> withdrawal, or instant break with <strong>20% penalty</strong>.</li>
            <li><strong>2% loyalty top-up</strong> on every notice-period withdrawal (paid from take-rate, not interest).</li>
            <li>Every cached balance is reconcilable via the immutable SavingsMovement ledger.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
