import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

const CATEGORIES = [
  "HAIR_CARE",
  "MAKEUP",
  "NAILS",
  "LASHES",
  "SKINCARE",
  "TOOLS",
  "CONSUMABLE",
  "OTHER",
] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  sku: z.string().max(60).nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
  unit: z.string().min(1).max(20).optional(),
  unitCost: z.number().min(0).optional(),
  description: z.string().max(1000).nullable().optional(),
  photo: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
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
  const product = await db.product.findUnique({
    where: { id },
    include: {
      recipes: {
        include: {
          service: {
            select: { id: true, name: true, slug: true, category: true },
          },
        },
      },
      _count: { select: { inventories: true } },
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: product });
}

export async function PUT(
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
    const data = updateSchema.parse(body);

    if (data.slug) {
      const clash = await db.product.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (clash) {
        return NextResponse.json(
          { error: "Slug already in use" },
          { status: 409 },
        );
      }
    }
    if (data.sku) {
      const clash = await db.product.findFirst({
        where: { sku: data.sku, NOT: { id } },
      });
      if (clash) {
        return NextResponse.json(
          { error: "SKU already in use" },
          { status: 409 },
        );
      }
    }

    const updated = await db.product.update({
      where: { id },
      data,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "product.update",
      entityType: "product",
      entityId: id,
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("update product error:", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  }
}

// Soft delete = flip isActive=false. The product is still referenced from
// inventory rows and recipes; hard delete would cascade and rewrite history.
// Reject if any active service still uses this product in its recipe — clean
// those up first so we don't silently break decrements.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const activeRecipes = await db.serviceRecipe.findMany({
    where: { productId: id, service: { isActive: true } },
    select: { service: { select: { id: true, name: true } } },
  });
  if (activeRecipes.length > 0) {
    return NextResponse.json(
      {
        error: `Product is still on the recipe for ${activeRecipes.length} active service(s). Remove it from each recipe first.`,
        services: activeRecipes.map((r) => r.service),
      },
      { status: 409 },
    );
  }

  await db.product.update({
    where: { id },
    data: { isActive: false },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "product.deactivate",
    entityType: "product",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}

// PATCH alias matches the Concept #2 spec ("PATCH /api/admin/products/[id]").
// We keep PUT for the existing UI client too.
export { PUT as PATCH };
