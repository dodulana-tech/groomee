import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira, cn } from "@/lib/utils";
import { format } from "date-fns";
import AdjustmentForm from "./AdjustmentForm";
import LedgerFilter from "./LedgerFilter";
import WalletTools from "./WalletTools";
import type { Metadata } from "next";
import type { WalletMovementType, Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Wallet — Pro detail" };
export const revalidate = 0;

const PAGE_SIZE = 50;

const ALLOWED_TYPES: WalletMovementType[] = [
  "MOBILIZATION",
  "COMPLETION_RELEASE",
  "CONFIRM_RELEASE",
  "APPRENTICE_COMMISSION_RELEASE",
  "CLAWBACK",
  "ADVANCE_DISBURSED",
  "ADVANCE_REPAYMENT",
  "PAYOUT_DEBIT",
  "PAYOUT_REVERSAL",
  "MANUAL_ADJUSTMENT",
  "SAVINGS_SKIM",
  "BENEFIT_PREMIUM",
];

const TYPE_BADGE: Record<string, string> = {
  MOBILIZATION: "bg-blue-100 text-blue-700",
  COMPLETION_RELEASE: "bg-indigo-100 text-indigo-700",
  CONFIRM_RELEASE: "bg-emerald-100 text-emerald-700",
  APPRENTICE_COMMISSION_RELEASE: "bg-purple-100 text-purple-700",
  CLAWBACK: "bg-red-100 text-red-700",
  ADVANCE_DISBURSED: "bg-amber-100 text-amber-700",
  ADVANCE_REPAYMENT: "bg-amber-100 text-amber-800",
  PAYOUT_DEBIT: "bg-gray-200 text-gray-700",
  PAYOUT_REVERSAL: "bg-gray-100 text-gray-700",
  MANUAL_ADJUSTMENT: "bg-yellow-100 text-yellow-800",
  SAVINGS_SKIM: "bg-teal-100 text-teal-700",
  BENEFIT_PREMIUM: "bg-rose-100 text-rose-700",
};

interface Props {
  params: Promise<{ proId: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function WalletProPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/auth?redirect=/admin/wallet");
  }
  if (!hasPermission(session, "wallet.view")) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
        <p className="mt-2 text-sm text-gray-500">No permission.</p>
      </div>
    );
  }
  const canManage = hasPermission(session, "wallet.manage");

  const { proId } = await params;
  const sp = await searchParams;
  const typeFilter = sp.type ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true, phone: true, status: true },
  });
  if (!pro) notFound();

  const where: Prisma.WalletLedgerWhereInput = { proId };
  if (typeFilter && ALLOWED_TYPES.includes(typeFilter as WalletMovementType)) {
    where.type = typeFilter as WalletMovementType;
  }

  const [wallet, rows, total, ledgerSumAgg] = await Promise.all([
    db.proWallet.findUnique({ where: { proId } }),
    db.walletLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.walletLedger.count({ where }),
    db.walletLedger.aggregate({
      where: { proId },
      _sum: { amount: true },
    }),
  ]);

  // Resolve booking references for visible rows
  const bookingIds = Array.from(
    new Set(rows.map((r) => r.bookingId).filter(Boolean)),
  ) as string[];
  const bookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, reference: true },
      })
    : [];
  const bookingRefMap = new Map(bookings.map((b) => [b.id, b.reference]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cachedAvailable = wallet?.available ?? 0;
  const forensicSum = ledgerSumAgg._sum.amount ?? 0;
  const cachedVsForensic = Math.abs(cachedAvailable - forensicSum);
  const cacheDrift = cachedVsForensic >= 0.01;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/wallet"
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            ← Wallets overview
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{pro.name}</h1>
          <p className="text-sm text-gray-500">
            {pro.phone} · <span className="uppercase">{pro.status}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/admin/pros/${pro.id}`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Pro profile →
          </Link>
          <WalletTools proId={pro.id} currentTypeFilter={typeFilter} />
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Available
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-bold",
              cachedAvailable < 0 ? "text-red-600" : "text-gray-900",
            )}
          >
            {formatNaira(cachedAvailable)}
          </p>
          {cacheDrift && (
            <p className="mt-1 text-[10px] text-red-500">
              ⚠ Cache drift vs ledger sum: {formatNaira(forensicSum)}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Pending
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">
            {formatNaira(wallet?.pending ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Net advance owed
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-bold",
              (wallet?.netAdvanceOwed ?? 0) > 0 ? "text-amber-700" : "text-gray-900",
            )}
          >
            {formatNaira(wallet?.netAdvanceOwed ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Credit limit
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">
            {formatNaira(wallet?.creditLimit ?? 0)}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="mb-6">
          <AdjustmentForm proId={pro.id} proName={pro.name} />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">Ledger</h2>
        <LedgerFilter proId={pro.id} current={typeFilter} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📜</p>
            <p className="font-semibold text-gray-600">No movements yet.</p>
            {typeFilter && (
              <p className="text-sm mt-1">Try a different movement type.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {[
                  "Date",
                  "Type",
                  "Amount",
                  "Balance after",
                  "Booking",
                  "Note",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const ref = r.bookingId ? bookingRefMap.get(r.bookingId) : null;
                const positive = r.amount >= 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(r.createdAt), "dd MMM yy, HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          TYPE_BADGE[r.type] ?? "bg-gray-100 text-gray-600",
                        )}
                      >
                        {r.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-bold",
                        positive ? "text-emerald-700" : "text-red-600",
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatNaira(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatNaira(r.balanceAfter)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ref ? (
                        <Link
                          href={`/admin/bookings/${r.bookingId}`}
                          className="text-brand-600 hover:underline"
                        >
                          {ref}
                        </Link>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[300px]">
                      <p className="truncate" title={r.note ?? ""}>
                        {r.note ?? "-"}
                      </p>
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
                ? `/admin/wallet/${pro.id}?${typeFilter ? `type=${typeFilter}&` : ""}page=${page - 1}`
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
            Page {page} of {totalPages} · {total} rows
          </span>
          <Link
            href={
              page < totalPages
                ? `/admin/wallet/${pro.id}?${typeFilter ? `type=${typeFilter}&` : ""}page=${page + 1}`
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
