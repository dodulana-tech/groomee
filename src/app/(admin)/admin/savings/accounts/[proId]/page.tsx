import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadSavingsSettings } from "@/lib/savings";
import { format } from "date-fns";
import { formatNaira } from "@/lib/utils";
import AccountActions from "./AccountActions";
import WithdrawalActions from "./WithdrawalActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reserve account · Admin" };
export const revalidate = 0;

interface Props {
  params: Promise<{ proId: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 50;

export default async function AccountDetailPage({ params, searchParams }: Props) {
  const { proId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const account = await db.proSavingsAccount.findUnique({
    where: { proId },
    include: { pro: { select: { id: true, name: true, phone: true, bankName: true, bankAccount: true } } },
  });
  if (!account) notFound();

  const [movements, totalMovements, withdrawals, settings] = await Promise.all([
    db.savingsMovement.findMany({
      where: { proId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.savingsMovement.count({ where: { proId } }),
    db.savingsWithdrawal.findMany({
      where: { proId },
      orderBy: { createdAt: "desc" },
    }),
    loadSavingsSettings(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalMovements / PAGE_SIZE));

  const stats = [
    { label: "Locked", value: formatNaira(account.balanceLocked), hint: "Still in clawback window" },
    { label: "Available", value: formatNaira(account.balanceAvailable), hint: "Withdrawable" },
    { label: "Pending", value: formatNaira(account.balancePendingWd), hint: "Reserved on open requests" },
    { label: "Skimmed (lifetime)", value: formatNaira(account.totalSkimmed) },
    { label: "Match earned (lifetime)", value: formatNaira(account.totalMatchEarned) },
    { label: "Withdrawn (lifetime)", value: formatNaira(account.totalWithdrawn) },
    { label: "Clawed back (lifetime)", value: formatNaira(account.totalClawedBack) },
    { label: "Skim rate", value: `${(account.skimRate * 100).toFixed(1)}%` },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/savings/accounts" className="text-xs text-gray-400 hover:underline">← Accounts</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{account.pro.name}</h1>
          <p className="text-sm text-gray-500">{account.pro.phone}</p>
          <p className="text-xs text-gray-400">
            {account.optedIn
              ? `Enrolled ${account.optedInAt ? format(new Date(account.optedInAt), "dd MMM yyyy") : ""} — ${(account.skimRate * 100).toFixed(1)}%`
              : `Opted out ${account.optedOutAt ? format(new Date(account.optedOutAt), "dd MMM yyyy") : ""}`}
          </p>
          {account.goalLabels.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">Goals: {account.goalLabels.join(", ")}</p>
          )}
        </div>
        <Link href={`/admin/pros/${account.proId}`} className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200">
          Pro profile →
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-3">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
            {s.hint && <p className="text-xs text-gray-500 mt-0.5">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Withdrawals */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Withdrawals</h2>
              <span className="text-xs text-gray-400">{withdrawals.length} total</span>
            </div>
            {withdrawals.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No withdrawals yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-100">
                    {["When", "Type", "Gross", "Net", "Status", "Eligible", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{format(new Date(w.createdAt), "dd MMM HH:mm")}</td>
                      <td className="px-3 py-2 text-xs">
                        {w.isInstant ? (
                          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-bold">INSTANT</span>
                        ) : (
                          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-bold">NOTICE</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{formatNaira(w.amount)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{formatNaira(w.netAmount)}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-bold rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{w.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {w.noticeUntil ? format(new Date(w.noticeUntil), "dd MMM") : (w.isInstant ? "—" : "")}
                      </td>
                      <td className="px-3 py-2">
                        <WithdrawalActions withdrawalId={w.id} status={w.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Ledger */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Reserve ledger</h2>
              <span className="text-xs text-gray-400">{totalMovements} rows</span>
            </div>
            {movements.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No activity yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-100">
                    {["When", "Type", "Amount", "Balance after", "Note"].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{format(new Date(m.createdAt), "dd MMM HH:mm")}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{m.type}</span>
                      </td>
                      <td className={`px-3 py-2 font-bold ${m.amount > 0 ? "text-green-700" : m.amount < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {m.amount > 0 ? "+" : ""}{formatNaira(m.amount)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{formatNaira(m.balanceAfter)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[260px] truncate" title={m.note ?? ""}>{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-gray-400 p-3 border-t border-gray-100">
                <Link
                  href={page > 1 ? `?page=${page - 1}` : "#"}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "opacity-40" : "hover:underline"}
                >← Previous</Link>
                <span>Page {page} of {totalPages}</span>
                <Link
                  href={page < totalPages ? `?page=${page + 1}` : "#"}
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? "opacity-40" : "hover:underline"}
                >Next →</Link>
              </div>
            )}
          </div>
        </div>

        <AccountActions
          proId={account.proId}
          proName={account.pro.name}
          optedIn={account.optedIn}
          currentRate={account.skimRate}
          sliderMin={settings.sliderMin}
          sliderMax={settings.sliderMax}
          goalLabels={account.goalLabels}
          balanceAvailable={account.balanceAvailable}
        />
      </div>
    </div>
  );
}
