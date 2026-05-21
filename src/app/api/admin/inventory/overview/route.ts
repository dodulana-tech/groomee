import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "inventory.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since7d = new Date(Date.now() - 7 * 86400_000);
  const since30d = new Date(Date.now() - 30 * 86400_000);

  const [
    totalProducts,
    activeProducts,
    inventoryRows,
    decrement7d,
    topConsumedRaw,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.proInventory.findMany({
      select: {
        id: true,
        proId: true,
        productId: true,
        qtyOnHand: true,
        lowStockThreshold: true,
        pro: { select: { id: true, name: true, phone: true } },
      },
    }),
    db.inventoryTxn.count({
      where: { reason: "BOOKING_DECREMENT", createdAt: { gte: since7d } },
    }),
    db.inventoryTxn.groupBy({
      by: ["productId"],
      where: { reason: "BOOKING_DECREMENT", createdAt: { gte: since30d } },
      _sum: { delta: true },
      orderBy: { _sum: { delta: "asc" } }, // most negative = most consumed
      take: 5,
    }),
  ]);

  const lowRows = inventoryRows.filter(
    (r) => r.qtyOnHand < r.lowStockThreshold,
  );
  const prosWithInventoryIds = new Set(inventoryRows.map((r) => r.proId));

  // Aggregate low-stock + total tracked per pro for the table.
  const perPro = new Map<
    string,
    {
      proId: string;
      proName: string;
      proPhone: string;
      productsTracked: number;
      lowCount: number;
    }
  >();
  for (const r of inventoryRows) {
    const cur = perPro.get(r.proId) ?? {
      proId: r.proId,
      proName: r.pro?.name ?? "—",
      proPhone: r.pro?.phone ?? "",
      productsTracked: 0,
      lowCount: 0,
    };
    cur.productsTracked += 1;
    if (r.qtyOnHand < r.lowStockThreshold) cur.lowCount += 1;
    perPro.set(r.proId, cur);
  }
  const prosTable = Array.from(perPro.values()).sort(
    (a, b) => b.lowCount - a.lowCount,
  );

  const topProductIds = topConsumedRaw.map((g) => g.productId);
  const topProducts = topProductIds.length
    ? await db.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, unit: true, category: true },
      })
    : [];
  const topProductMap = new Map(topProducts.map((p) => [p.id, p]));
  const topConsumed = topConsumedRaw.map((g) => ({
    productId: g.productId,
    product: topProductMap.get(g.productId) ?? null,
    qty: Math.abs(g._sum.delta ?? 0),
  }));

  return NextResponse.json({
    data: {
      kpis: {
        totalProducts,
        activeProducts,
        prosWithInventory: prosWithInventoryIds.size,
        lowStockCount: lowRows.length,
        decrement7d,
      },
      pros: prosTable,
      topConsumed,
    },
  });
}
