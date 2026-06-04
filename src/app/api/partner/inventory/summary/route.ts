import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProStockSummary, lowStockSummary } from "@/lib/inventory";

// GET /api/partner/inventory/summary
// KPI numbers + low-stock list for the pro's dashboard view.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const pro = await db.pro.findFirst({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!pro) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 403 },
      );
    }

    const [stock, lowList, lastRestockTxn] = await Promise.all([
      getProStockSummary(pro.id),
      lowStockSummary(pro.id),
      db.inventoryTxn.findFirst({
        where: { proId: pro.id, reason: { in: ["RESTOCK", "INITIAL_STOCK"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        productsTracked: stock.length,
        lowCount: lowList.length,
        lastRestockedAt: lastRestockTxn?.createdAt ?? null,
        lowStock: lowList.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          unit: r.productUnit,
          qtyOnHand: r.qtyOnHand,
          threshold: r.lowStockThreshold,
          deficit: r.deficit,
          lastRestockedAt: r.lastRestockedAt,
        })),
      },
    });
  } catch (err) {
    console.error("partner inventory summary error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load summary" },
      { status: 500 },
    );
  }
}
