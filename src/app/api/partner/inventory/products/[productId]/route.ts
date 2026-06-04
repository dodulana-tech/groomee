import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/partner/inventory/products/[productId]
// Per-product detail for the pro:
//   - the Product row
//   - the pro's ProInventory row (or null if not tracked yet)
//   - recent BOOKING_DECREMENT / RESTOCK / WASTE txns (last 20 each)
//   - which Services consume this product (ServiceRecipe rows)
//   - 30-day consumption total
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
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

    const { productId } = await params;

    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        unit: true,
        unitCost: true,
        description: true,
        photo: true,
        isActive: true,
      },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    const since30d = new Date(Date.now() - 30 * 86400_000);

    const [inv, decrements, restocks, wastes, recipes, monthConsumed] =
      await Promise.all([
        db.proInventory.findUnique({
          where: { proId_productId: { proId: pro.id, productId } },
        }),
        db.inventoryTxn.findMany({
          where: { proId: pro.id, productId, reason: "BOOKING_DECREMENT" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            delta: true,
            qtyAfter: true,
            bookingId: true,
            note: true,
          },
        }),
        db.inventoryTxn.findMany({
          where: {
            proId: pro.id,
            productId,
            reason: { in: ["RESTOCK", "INITIAL_STOCK"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            delta: true,
            qtyAfter: true,
            reason: true,
            note: true,
          },
        }),
        db.inventoryTxn.findMany({
          where: { proId: pro.id, productId, reason: "WASTE" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            delta: true,
            qtyAfter: true,
            note: true,
          },
        }),
        db.serviceRecipe.findMany({
          where: { productId },
          include: {
            service: {
              select: { id: true, name: true, slug: true },
            },
          },
        }),
        db.inventoryTxn.aggregate({
          where: {
            proId: pro.id,
            productId,
            reason: "BOOKING_DECREMENT",
            createdAt: { gte: since30d },
          },
          _sum: { delta: true },
        }),
      ]);

    const consumed30d = Math.abs(monthConsumed._sum.delta ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        product,
        inventory: inv,
        isLow: inv ? inv.qtyOnHand < inv.lowStockThreshold : false,
        decrements,
        restocks,
        wastes,
        recipes: recipes.map((r) => ({
          id: r.id,
          serviceId: r.service.id,
          serviceName: r.service.name,
          serviceSlug: r.service.slug,
          qtyPerService: r.qtyPerService,
          isOptional: r.isOptional,
          note: r.note,
        })),
        consumed30d,
      },
    });
  } catch (err) {
    console.error("partner inventory product detail error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load product detail" },
      { status: 500 },
    );
  }
}
