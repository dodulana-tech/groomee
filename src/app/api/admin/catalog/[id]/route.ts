import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { z } from "zod";

const naira = z.number().int().positive().max(10_000_000);
const updateSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable(),
    basePrice: naira,
    minPrice: naira,
    maxPrice: naira,
    durationMins: z.number().int().positive().max(480),
    isActive: z.boolean(),
  })
  .partial();

// PATCH /api/admin/catalog/:id — edit a service (prices, name, duration, active).
// Public pages (service pages, price list, guides, llms.txt) read these prices,
// so they're refreshed straight away.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "catalog.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const input = updateSchema.parse(await req.json());
    const current = await db.service.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });

    const min = input.minPrice ?? current.minPrice;
    const max = input.maxPrice ?? current.maxPrice;
    if (min > max) {
      return NextResponse.json({ success: false, error: "The lowest price can't be above the highest." }, { status: 400 });
    }
    // basePrice is what a booking is quoted from; keep it inside the range.
    let base = input.basePrice ?? current.basePrice;
    if (base < min || base > max) base = min;

    const service = await db.service.update({
      where: { id },
      data: { ...input, minPrice: min, maxPrice: max, basePrice: base },
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "catalog.update",
      entityType: "service",
      entityId: id,
      metadata: {
        before: { minPrice: current.minPrice, maxPrice: current.maxPrice, basePrice: current.basePrice },
        after: { minPrice: min, maxPrice: max, basePrice: base },
        fields: Object.keys(input),
      },
    }).catch(() => {});

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, data: service });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    console.error("update service error:", err);
    return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 });
  }
}
