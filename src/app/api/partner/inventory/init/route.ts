import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { INVENTORY_DEFAULTS } from "@/lib/inventory";

// POST /api/partner/inventory/init
// Begin tracking a product the pro keeps on hand. Creates a ProInventory row
// (or no-ops if one already exists for them) and writes an INITIAL_STOCK
// InventoryTxn for the starting qty. Threshold can also be set in the same
// call so the picker is a one-shot setup.
const schema = z.object({
  productId: z.string().min(1),
  qty: z.number().min(0).max(10_000),
  threshold: z.number().min(0).max(1_000).optional(),
  note: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
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

    const parsed = schema.parse(await req.json());

    const product = await db.product.findUnique({
      where: { id: parsed.productId },
      select: { id: true, isActive: true, name: true },
    });
    if (!product || !product.isActive) {
      return NextResponse.json(
        { success: false, error: "Product not available" },
        { status: 404 },
      );
    }

    const threshold = parsed.threshold ?? INVENTORY_DEFAULTS.lowStockThreshold;
    const proId = pro.id;
    const { productId, qty, note } = parsed;

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.proInventory.findUnique({
        where: { proId_productId: { proId, productId } },
      });
      if (existing) {
        // Already tracking — surface a clear error instead of silently
        // mutating someone's history.
        throw new Error("ALREADY_TRACKED");
      }
      const inv = await tx.proInventory.create({
        data: {
          proId,
          productId,
          qtyOnHand: qty,
          lowStockThreshold: threshold,
          ...(qty > 0 ? { lastRestockedAt: new Date() } : {}),
        },
      });
      if (qty > 0) {
        await tx.inventoryTxn.create({
          data: {
            proId,
            productId,
            inventoryId: inv.id,
            delta: qty,
            qtyAfter: qty,
            reason: "INITIAL_STOCK",
            note: note ?? null,
          },
        });
      }
      return inv;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message === "ALREADY_TRACKED") {
      return NextResponse.json(
        {
          success: false,
          error: "You're already tracking this product. Use Restock instead.",
        },
        { status: 409 },
      );
    }
    console.error("partner inventory init error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add product" },
      { status: 500 },
    );
  }
}
