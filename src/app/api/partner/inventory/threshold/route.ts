import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// PATCH /api/partner/inventory/threshold
// Edit the low-stock threshold for one of the pro's tracked products.
// Threshold can be 0 (disables alerts) up to 1000 (sanity ceiling).
const schema = z.object({
  productId: z.string().min(1),
  threshold: z.number().min(0).max(1_000),
});

export async function PATCH(req: NextRequest) {
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

    // Scoped to the session pro's id — never trust input for ownership.
    const inv = await db.proInventory.findUnique({
      where: {
        proId_productId: { proId: pro.id, productId: parsed.productId },
      },
    });
    if (!inv) {
      return NextResponse.json(
        { success: false, error: "Product is not tracked yet." },
        { status: 404 },
      );
    }

    const updated = await db.proInventory.update({
      where: { id: inv.id },
      data: { lowStockThreshold: parsed.threshold },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    console.error("partner inventory threshold error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update threshold" },
      { status: 500 },
    );
  }
}
