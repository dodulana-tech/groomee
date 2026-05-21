import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { restockProduct } from "@/lib/inventory";
import { logAdminAction } from "@/lib/admin-audit";

const schema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive(),
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
      select: { id: true, phone: true },
    });
    if (!pro) return NextResponse.json({ error: "Pro not found" }, { status: 404 });

    const product = await db.product.findUnique({
      where: { id: parsed.productId },
      select: { id: true, name: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const result = await restockProduct({
      proId,
      productId: parsed.productId,
      qty: parsed.qty,
      note: parsed.note,
      adminId: session!.userId,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "inventory.restock",
      entityType: "pro-inventory",
      entityId: result.inventory.id,
      metadata: {
        proId,
        productId: parsed.productId,
        productName: product.name,
        qty: parsed.qty,
        newQty: result.inventory.qtyOnHand,
        note: parsed.note ?? null,
      },
    });

    // Confirmation WhatsApp to the pro (fire-and-forget).
    if (pro.phone) {
      import("@/lib/whatsapp")
        .then(({ notifyProRestockLogged }) =>
          notifyProRestockLogged(pro.phone, product.name, result.inventory.qtyOnHand),
        )
        .catch(console.error);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("restock error:", err);
    return NextResponse.json({ error: "Failed to restock" }, { status: 500 });
  }
}
