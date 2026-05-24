import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { restockProduct } from "@/lib/inventory";

// POST /api/partner/inventory/restock
// The pro logs a real-world purchase against a product they already track.
// Idempotency: not enforced server-side — these are explicit user-initiated
// actions, so a double-tap could theoretically post twice. Client buttons
// disable while in flight which covers the practical case.
const schema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive().max(10_000),
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

    const result = await restockProduct({
      proId: pro.id,
      productId: parsed.productId,
      qty: parsed.qty,
      note: parsed.note,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    console.error("partner inventory restock error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to log restock" },
      { status: 500 },
    );
  }
}
