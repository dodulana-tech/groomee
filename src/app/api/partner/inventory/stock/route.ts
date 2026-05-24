import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProStockSummary } from "@/lib/inventory";

// GET /api/partner/inventory/stock
// All ProInventory rows for the signed-in pro, joined with Product. Used by
// the main /partner/inventory page table.
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

    const stock = await getProStockSummary(pro.id);
    return NextResponse.json({ success: true, data: stock });
  } catch (err) {
    console.error("partner inventory stock error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load stock" },
      { status: 500 },
    );
  }
}
