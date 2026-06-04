import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

const createSchema = z.object({
  productId: z.string().min(1),
  qtyPerService: z.number().positive(),
  isOptional: z.boolean().optional().default(false),
  note: z.string().max(200).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const service = await db.service.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      durationMins: true,
      basePrice: true,
    },
  });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const recipes = await db.serviceRecipe.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          unit: true,
          unitCost: true,
          isActive: true,
        },
      },
    },
  });
  return NextResponse.json({ data: { service, recipes } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const service = await db.service.findUnique({ where: { id }, select: { id: true } });
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    const product = await db.product.findUnique({
      where: { id: parsed.productId },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const existing = await db.serviceRecipe.findUnique({
      where: { serviceId_productId: { serviceId: id, productId: parsed.productId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Product already on this recipe — edit the existing row instead." },
        { status: 409 },
      );
    }

    const recipe = await db.serviceRecipe.create({
      data: {
        serviceId: id,
        productId: parsed.productId,
        qtyPerService: parsed.qtyPerService,
        isOptional: parsed.isOptional ?? false,
        note: parsed.note ?? null,
      },
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "recipe.create",
      entityType: "service-recipe",
      entityId: recipe.id,
      metadata: {
        serviceId: id,
        productId: parsed.productId,
        qty: parsed.qtyPerService,
      },
    });

    return NextResponse.json({ success: true, data: recipe }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("create recipe error:", err);
    return NextResponse.json(
      { error: "Failed to create recipe row" },
      { status: 500 },
    );
  }
}
