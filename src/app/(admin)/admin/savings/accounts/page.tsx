import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reserve accounts · Admin" };
export const revalidate = 0;

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ search?: string; optedIn?: string; page?: string }>;
}

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Opted in", value: "true" },
  { label: "Opted out", value: "false" },
];

export default async function SavingsAccountsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const optedFilter = sp.optedIn ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.ProSavingsAccountWhereInput = {};
  if (optedFilter === "true") where.optedIn = true;
  if (optedFilter === "false") where.optedIn = false;
  if (search) {
    where.pro = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    };
  }

  const [rows, total] = await Promise.all([
    db.proSavingsAccount.findMany({
      where,
      include: { pro: { select: { id: true, name: true, phone: true } } },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.proSavingsAccount.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reserve accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Per-pro vaults. Every cached balance is auditable line-by-line.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/savings" className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200">← Overview</Link>
          <Link href="/admin/savings/withdrawals" className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200">Withdrawals</Link>
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2 flex-wrap items-center">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by name or phone"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          name="optedIn"
          defaultValue={optedFilter}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          {FILTER_TABS.map((t) => (
            <option key={t.value} value={t.value}>{t.label || "All"}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">🏦</p>
            <p>No accounts in this view.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {["Pro", "Status", "Rate", "Locked", "Available", "Pending", "Skimmed (lifetime)", "Last update", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <Link href={`/admin/savings/accounts/${r.proId}`} className="font-medium text-gray-900 hover:underline">
                      {r.pro.name}
                    </Link>
                    <p className="text-xs text-gray-400">{r.pro.phone}</p>
                  </td>
                  <td className="px-3 py-2">
                    {r.optedIn ? (
                      <span className="text-xs font-bold rounded-full bg-green-100 text-green-700 px-2 py-0.5">IN</span>
                    ) : (
                      <span className="text-xs font-bold rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">OUT</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{(r.skimRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-gray-700">{formatNaira(r.balanceLocked)}</td>
                  <td className="px-3 py-2 font-semibold text-green-700">{formatNaira(r.balanceAvailable)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatNaira(r.balancePendingWd)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatNaira(r.totalSkimmed)}</td>
                  <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{format(new Date(r.updatedAt), "dd MMM HH:mm")}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/savings/accounts/${r.proId}`} className="text-xs text-brand-600 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={page > 1 ? `/admin/savings/accounts?search=${encodeURIComponent(search)}&optedIn=${optedFilter}&page=${page - 1}` : "#"}
            aria-disabled={page <= 1}
            className={cn("rounded-xl px-4 py-2 font-semibold border border-gray-200", page <= 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50")}
          >← Previous</Link>
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <Link
            href={page < totalPages ? `/admin/savings/accounts?search=${encodeURIComponent(search)}&optedIn=${optedFilter}&page=${page + 1}` : "#"}
            aria-disabled={page >= totalPages}
            className={cn("rounded-xl px-4 py-2 font-semibold border border-gray-200", page >= totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50")}
          >Next →</Link>
        </div>
      )}
    </div>
  );
}
