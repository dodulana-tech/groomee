import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Customers" };
export const revalidate = 0;

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  const spendByUser = await db.booking.groupBy({
    by: ["customerId"],
    where: {
      status: { in: ["CONFIRMED", "COMPLETED"] },
      customerId: { in: customers.map((c) => c.id) },
    },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  const spendMap = Object.fromEntries(
    spendByUser.map((s) => [
      s.customerId,
      { total: s._sum.totalAmount ?? 0, count: s._count._all },
    ]),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQs = q ? `q=${encodeURIComponent(q)}` : "";

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">
          {total} total · showing {customers.length} (page {page} of {totalPages})
        </p>
      </div>

      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Search
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
            href="/admin/customers"
            className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Reset
          </Link>
        )}
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {["Customer", "Phone", "Bookings", "Total spend", "Joined", ""].map((h) => (
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
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No customers found.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const spend = spendMap[c.id];
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {c.name ?? <span className="text-gray-400 font-normal">No name</span>}
                      </p>
                      <p className="text-xs text-gray-400">{c.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {c.phone ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{c._count.bookings}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {spend ? formatNaira(spend.total) : <span className="text-gray-300 font-normal">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(new Date(c.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={page > 1 ? `/admin/customers?${baseQs}${baseQs ? "&" : ""}page=${page - 1}` : "#"}
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
            href={page < totalPages ? `/admin/customers?${baseQs}${baseQs ? "&" : ""}page=${page + 1}` : "#"}
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
