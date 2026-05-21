import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProStockSummary } from "@/lib/inventory";
import { format } from "date-fns";
import ProStockManager from "./ProStockManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pro stock" };
export const revalidate = 0;

export default async function ProInventoryPage({
  params,
}: {
  params: Promise<{ proId: string }>;
}) {
  const { proId } = await params;

  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true, phone: true, status: true },
  });
  if (!pro) notFound();

  const [stock, products, recentTxns] = await Promise.all([
    getProStockSummary(proId),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, unit: true, category: true },
    }),
    db.inventoryTxn.findMany({
      where: { proId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { product: { select: { id: true, name: true, unit: true } } },
    }),
  ]);

  const lowCount = stock.filter((s) => s.isLow).length;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/inventory" className="hover:text-gray-700">
          Inventory
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{pro.name}</span>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pro.name}</h1>
            <p className="text-sm text-gray-400 font-mono mt-0.5">
              {pro.phone}
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{stock.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Products tracked</p>
            </div>
            <div>
              <p
                className="text-xl font-bold"
                style={{ color: lowCount > 0 ? "#991B1B" : "#1A3A2A" }}
              >
                {lowCount}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Low stock</p>
            </div>
          </div>
        </div>
      </div>

      <ProStockManager
        proId={proId}
        initialStock={stock.map((s) => ({
          ...s,
          lastRestockedAt: s.lastRestockedAt
            ? s.lastRestockedAt.toISOString()
            : null,
          lastDecrementAt: s.lastDecrementAt
            ? s.lastDecrementAt.toISOString()
            : null,
        }))}
        products={products}
      />

      <div className="glass-card rounded-2xl p-5 mt-5">
        <h2 className="font-bold text-gray-900 mb-3">
          Transaction history · last 50
        </h2>
        {recentTxns.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2">When</th>
                <th className="py-2">Product</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Δ</th>
                <th className="py-2">After</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentTxns.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 text-xs text-gray-500">
                    {format(new Date(t.createdAt), "dd MMM HH:mm")}
                  </td>
                  <td className="py-2 text-gray-800">
                    {t.product?.name ?? "—"}
                  </td>
                  <td className="py-2 text-xs text-gray-500">{t.reason}</td>
                  <td
                    className="py-2 font-bold"
                    style={{ color: t.delta < 0 ? "#991B1B" : "#166534" }}
                  >
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </td>
                  <td className="py-2 text-gray-600">{t.qtyAfter}</td>
                  <td className="py-2 text-xs text-gray-500 truncate max-w-[200px]">
                    {t.note ?? "—"}
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
