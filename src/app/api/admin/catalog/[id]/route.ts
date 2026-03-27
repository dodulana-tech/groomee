import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  category: z.enum(["HAIR", "MAKEUP", "NAILS", "BARBING", "LASHES", "SKINCARE", "OTHER"]),
  description: z.string().max(500).optional(),
  basePrice: z.number().positive(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  durationMins: z.number().int().positive().max(480),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "catalog.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, category, description, basePrice, minPrice, maxPrice, durationMins } =
      createServiceSchema.parse(body);

    // Check slug uniqueness
    const existing = await db.service.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A service with that slug already exists" },
        { status: 409 },
      );
    }

    const service = await db.service.create({
      data: {
        name,
        slug,
        category,
        description: description ?? null,
        basePrice,
        minPrice: minPrice ?? basePrice,
        maxPrice: maxPrice ?? basePrice,
        durationMins,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("create service error:", err);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 },
    );
  }
}
