import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/partner/inventory/catalog
// Returns the full active product catalogue so the pro can pick what they
// keep on hand when adding a new tracked product. Only basic fields the
// picker needs — no recipes / inventories.
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

    const [products, alreadyTracked] = await Promise.all([
      db.product.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          unit: true,
          unitCost: true,
          photo: true,
        },
      }),
      db.proInventory.findMany({
        where: { proId: pro.id },
        select: { productId: true },
      }),
    ]);

    const trackedIds = new Set(alreadyTracked.map((r) => r.productId));

    return NextResponse.json({
      success: true,
      data: products.map((p) => ({
        ...p,
        alreadyTracked: trackedIds.has(p.id),
      })),
    });
  } catch (err) {
    console.error("partner inventory catalog error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load catalog" },
      { status: 500 },
    );
  }
}
