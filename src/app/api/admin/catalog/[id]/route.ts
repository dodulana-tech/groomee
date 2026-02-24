import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      slug,
      category,
      description,
      basePrice,
      minPrice,
      maxPrice,
      durationMins,
    } = body;

    if (!name || !slug || !category || !basePrice || !durationMins) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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
        description: description || null,
        basePrice: Number(basePrice),
        minPrice: Number(minPrice || basePrice),
        maxPrice: Number(maxPrice || basePrice),
        durationMins: Number(durationMins),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (err) {
    console.error("create service error:", err);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 },
    );
  }
}
