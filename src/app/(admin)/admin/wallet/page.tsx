import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";
import { loadWalletOverviewKpis, listProWalletSummaries } from "@/lib/wallet";
import { formatNaira } from "@/lib/utils";
import { format } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallets — Overview" };
export const revalidate = 0;

export default async function WalletOverviewPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login?redirect=/admin/wallet");
  }
  if (!hasPermission(session, "wallet.view")) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
        <p className="mt-2 text-sm text-gray-500">
          You don't have permission to view wallets.
        </p>
      </div>
    );
  }

  const [kpis, pros] = await Promise.all([
    loadWalletOverviewKpis(),
    listProWalletSummaries(),
  ]);

  const kpiCards = [
    {
      label: "Total available",
      value: formatNaira(kpis.totalAvailable),
      hint: "Sum across all pro wallets",
    },
    {
      label: "Total pending",
      value: formatNaira(kpis.totalPending),
      hint: "Held for in-flight bookings",
    },
    {
      label: "Net advance owed",
      value: formatNaira(kpis.totalNetAdvanceOwed),
      hint: "Cash advanced, not yet recovered",
    },
    {
      label: "Pros in the red",
      value: kpis.prosWithNegativeBalance.toLocaleString(),
      hint: "Available balance < 0",
    },
    {
      label: "Today's mobilization",
      value: formatNaira(kpis.todayMobilizationSum),
      hint: "Posted since midnight",
    },
    {
      label: "Today's clawback",
      value: formatNaira(kpis.todayClawbackSum),
      hint: "Reversed since midnight",
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live earnings ledger across every pro. {pros.length} wallet
            {pros.length === 1 ? "" : "s"} active.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/wallet/movements"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            All movements
          </Link>
          <Link
            href="/admin/wallet/settings"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {k.label}
            </p>
            <p className="mt-1.5 text-xl font-bold text-gray-900">{k.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {pros.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-3xl mb-2">👛</p>
            <p className="font-semibold text-gray-600">No pro wallets yet.</p>
            <p className="text-sm mt-1">
              Wallets initialize on first earning movement.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                {[
                  "Pro",
                  "Phone",
                  "Available",
                  "Pending",
                  "Net advance owed",
                  "Last movement",
                  "",
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
              {pros.map((p) => (
                <tr key={p.proId} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/wallet/${p.proId}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.phone}</td>
                  <td
                    className={`px-4 py-3 font-bold ${
                      p.available < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatNaira(p.available)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatNaira(p.pending)}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      p.netAdvanceOwed > 0 ? "text-amber-700 font-semibold" : "text-gray-500"
                    }`}
                  >
                    {formatNaira(p.netAdvanceOwed)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {p.lastMovementAt
                      ? format(new Date(p.lastMovementAt), "dd MMM, HH:mm")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/wallet/${p.proId}`}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Ledger →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
