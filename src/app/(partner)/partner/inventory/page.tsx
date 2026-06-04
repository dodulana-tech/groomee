import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProStockSummary, lowStockSummary } from "@/lib/inventory";
import InventoryClient from "./InventoryClient";

export const metadata: Metadata = { title: "Stock · Groomee Partner" };
export const revalidate = 0;

export default async function PartnerInventoryPage() {
  const session = await getSession();
  if (!session) redirect("/auth");
  if (session.role !== "PRO" && session.role !== "ADMIN") redirect("/");

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true, name: true },
  });

  if (!pro) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Pro profile not found
          </h1>
          <p className="text-sm text-gray-500">
            We couldn&apos;t find your pro record. Please contact support.
          </p>
          <Link
            href="/partner"
            className="mt-4 inline-block text-sm font-bold text-green-700 hover:text-green-800"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const [stock, lowList, products, lastRestockTxn] = await Promise.all([
    getProStockSummary(pro.id),
    lowStockSummary(pro.id),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        unit: true,
        category: true,
        unitCost: true,
        photo: true,
      },
    }),
    db.inventoryTxn.findFirst({
      where: { proId: pro.id, reason: { in: ["RESTOCK", "INITIAL_STOCK"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const trackedIds = new Set(stock.map((s) => s.productId));

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">
            Track the supplies you bring to bookings. We auto-decrement when a
            job is confirmed and ping you when you&apos;re running low.
          </p>
        </div>
        <Link
          href="/partner/inventory/history"
          className="text-sm font-bold text-green-700 hover:text-green-800"
        >
          Full history →
        </Link>
      </div>

      <InventoryClient
        initialStock={stock.map((s) => ({
          ...s,
          lastRestockedAt: s.lastRestockedAt
            ? s.lastRestockedAt.toISOString()
            : null,
          lastDecrementAt: s.lastDecrementAt
            ? s.lastDecrementAt.toISOString()
            : null,
        }))}
        initialLow={lowList.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          unit: r.productUnit,
          qtyOnHand: r.qtyOnHand,
          threshold: r.lowStockThreshold,
        }))}
        catalog={products.map((p) => ({
          ...p,
          alreadyTracked: trackedIds.has(p.id),
        }))}
        lastRestockedAt={
          lastRestockTxn?.createdAt
            ? lastRestockTxn.createdAt.toISOString()
            : null
        }
      />
    </div>
  );
}
