import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProStockSummary } from "@/lib/inventory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "inventory.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { proId } = await params;
  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true, phone: true },
  });
  if (!pro) return NextResponse.json({ error: "Pro not found" }, { status: 404 });

  const [stock, recentTxns] = await Promise.all([
    getProStockSummary(proId),
    db.inventoryTxn.findMany({
      where: { proId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { product: { select: { id: true, name: true, unit: true } } },
    }),
  ]);

  return NextResponse.json({ data: { pro, stock, recentTxns } });
}
