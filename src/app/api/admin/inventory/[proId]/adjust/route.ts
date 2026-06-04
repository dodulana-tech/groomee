import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { adjustProductInventory } from "@/lib/inventory";
import { logAdminAction } from "@/lib/admin-audit";

const schema = z.object({
  productId: z.string().min(1),
  newQty: z.number().min(0),
  reason: z.enum(["ADMIN_ADJUSTMENT", "CORRECTION", "WASTE"]).optional(),
  note: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { proId } = await params;
    const parsed = schema.parse(await req.json());

    const pro = await db.pro.findUnique({
      where: { id: proId },
      select: { id: true },
    });
    if (!pro) return NextResponse.json({ error: "Pro not found" }, { status: 404 });

    const product = await db.product.findUnique({
      where: { id: parsed.productId },
      select: { id: true, name: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const result = await adjustProductInventory({
      proId,
      productId: parsed.productId,
      newQty: parsed.newQty,
      reason: parsed.reason,
      note: parsed.note,
      adminId: session!.userId,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "inventory.adjust",
      entityType: "pro-inventory",
      entityId: result.inventory.id,
      metadata: {
        proId,
        productId: parsed.productId,
        productName: product.name,
        newQty: parsed.newQty,
        reason: parsed.reason ?? "ADMIN_ADJUSTMENT",
        note: parsed.note ?? null,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("adjust error:", err);
    return NextResponse.json({ error: "Failed to adjust" }, { status: 500 });
  }
}
