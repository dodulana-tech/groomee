import { db } from "@/lib/db";
import { format } from "date-fns";
import { formatNaira } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customers" };
export const revalidate = 0;

export default async function AdminCustomersPage() {
  const [customers, spendByUser] = await Promise.all([
    db.user.findMany({
      where: { role: "CUSTOMER" },
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.groupBy({
      by: ["customerId"],
      where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const spendMap = Object.fromEntries(
    spendByUser.map((s) => [
      s.customerId,
      { total: s._sum.totalAmount ?? 0, count: s._count._all },
    ]),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">
          {customers.length} registered customers
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {["Customer", "Phone", "Bookings", "Total spend", "Joined"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No customers yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const spend = spendMap[c.id];
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {c.name ?? (
                          <span className="text-gray-400 font-normal">
                            No name
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{c.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {c._count.bookings}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {spend ? (
                        formatNaira(spend.total)
                      ) : (
                        <span className="text-gray-300 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(new Date(c.createdAt), "dd MMM yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
