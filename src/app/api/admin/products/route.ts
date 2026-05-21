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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  sku: z.string().max(60).optional().nullable(),
  category: z.enum(CATEGORIES),
  unit: z.string().min(1).max(20).default("piece"),
  unitCost: z.number().min(0).default(0),
  description: z.string().max(1000).optional().nullable(),
  photo: z.string().url().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "products.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim() ?? "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where: any = {};
  if (category && CATEGORIES.includes(category as any)) where.category = category;
  if (!includeInactive) where.isActive = true;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const since30d = new Date(Date.now() - 30 * 86400_000);
  const products = await db.product.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { recipes: true, inventories: true } },
    },
  });

  // Decrement totals over last 30d per product, in one query.
  const decrementGroups = await db.inventoryTxn.groupBy({
    by: ["productId"],
    where: {
      reason: "BOOKING_DECREMENT",
      createdAt: { gte: since30d },
      productId: { in: products.map((p) => p.id) },
    },
    _sum: { delta: true },
  });
  const decrementByProduct = new Map(
    decrementGroups.map((g) => [g.productId, Math.abs(g._sum.delta ?? 0)]),
  );

  return NextResponse.json({
    data: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      unitCost: p.unitCost,
      description: p.description,
      photo: p.photo,
      isActive: p.isActive,
      recipesCount: p._count.recipes,
      prosCount: p._count.inventories,
      decrement30d: decrementByProduct.get(p.id) ?? 0,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "products.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const existing = await db.product.findUnique({ where: { slug: parsed.slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A product with that slug already exists" },
        { status: 409 },
      );
    }
    if (parsed.sku) {
      const skuClash = await db.product.findUnique({ where: { sku: parsed.sku } });
      if (skuClash) {
        return NextResponse.json(
          { error: "SKU already in use" },
          { status: 409 },
        );
      }
    }

    const product = await db.product.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        sku: parsed.sku ?? null,
        category: parsed.category,
        unit: parsed.unit,
        unitCost: parsed.unitCost,
        description: parsed.description ?? null,
        photo: parsed.photo ?? null,
      },
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      metadata: { name: product.name, slug: product.slug },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("create product error:", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}
