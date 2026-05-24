import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/partner/inventory/waste
// The pro logs spillage / breakage / loss against a tracked product. Note is
// required (min 5 chars) to discourage casual use. We never let waste push
// qtyOnHand below zero — if the pro thinks they've "wasted" more than they
// have, that's a confused state and the call is rejected. They can restock
// first or contact admin for a correction.
const schema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive().max(10_000),
  note: z.string().trim().min(5).max(120),
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
    const proId = pro.id;
    const { productId, qty, note } = parsed;

    const result = await db.$transaction(async (tx) => {
      const inv = await tx.proInventory.findUnique({
        where: { proId_productId: { proId, productId } },
      });
      if (!inv) {
        throw new Error("NOT_TRACKED");
      }
      if (qty > inv.qtyOnHand) {
        throw new Error("INSUFFICIENT_STOCK");
      }
      const newQty = inv.qtyOnHand - qty;
      const updated = await tx.proInventory.update({
        where: { id: inv.id },
        data: { qtyOnHand: newQty },
      });
      const txn = await tx.inventoryTxn.create({
        data: {
          proId,
          productId,
          inventoryId: inv.id,
          delta: -qty,
          qtyAfter: newQty,
          reason: "WASTE",
          note,
        },
      });
      return { inventory: updated, txn };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    if (err instanceof Error) {
      if (err.message === "NOT_TRACKED") {
        return NextResponse.json(
          { success: false, error: "You don't have this product on hand yet." },
          { status: 404 },
        );
      }
      if (err.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          {
            success: false,
            error:
              "You can't log more waste than you have on hand. Restock first or ask support to correct your stock.",
          },
          { status: 400 },
        );
      }
    }
    console.error("partner inventory waste error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to log waste" },
      { status: 500 },
    );
  }
}
