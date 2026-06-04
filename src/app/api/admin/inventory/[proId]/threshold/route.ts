import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { setLowStockThreshold } from "@/lib/inventory";
import { logAdminAction } from "@/lib/admin-audit";

const schema = z.object({
  productId: z.string().min(1),
  threshold: z.number().min(0),
});

export async function PUT(
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

    const inv = await setLowStockThreshold({
      proId,
      productId: parsed.productId,
      threshold: parsed.threshold,
      adminId: session!.userId,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "inventory.threshold",
      entityType: "pro-inventory",
      entityId: inv.id,
      metadata: { proId, productId: parsed.productId, threshold: parsed.threshold },
    });

    return NextResponse.json({ success: true, data: inv });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("threshold error:", err);
    return NextResponse.json({ error: "Failed to set threshold" }, { status: 500 });
  }
}

// PATCH alias for callers that expect PATCH semantics (per Concept #2 spec).
export { PUT as PATCH };
