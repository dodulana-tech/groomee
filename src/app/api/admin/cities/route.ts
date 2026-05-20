import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CITY_PERMISSIONS } from "@/lib/cities";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/cities — list ALL cities for the admin (incl. HIDDEN).
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, CITY_PERMISSIONS.view)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  const cities = await db.city.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { zones: true } },
    },
  });
  return NextResponse.json({
    success: true,
    data: cities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: c.status,
      launchedAt: c.launchedAt,
      tagline: c.tagline,
      sortOrder: c.sortOrder,
      zoneCount: c._count.zones,
      updatedAt: c.updatedAt,
    })),
  });
}

const createSchema = z
  .object({
    name: z.string().min(2).max(40),
    slug: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters / digits / hyphens"),
    status: z.enum(["HIDDEN", "WAITLIST", "LIVE"]).optional(),
    tagline: z.string().max(200).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

// POST /api/admin/cities — create a new city (defaults to WAITLIST).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, CITY_PERMISSIONS.manage)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  try {
    const raw = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }
    const exists = await db.city.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (exists) {
      return NextResponse.json(
        { success: false, error: "A city with that slug already exists." },
        { status: 409 },
      );
    }
    const created = await db.city.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        status: parsed.data.status ?? "WAITLIST",
        tagline: parsed.data.tagline ?? null,
        sortOrder: parsed.data.sortOrder ?? 99,
        launchedAt: parsed.data.status === "LIVE" ? new Date() : null,
      },
    });
    await logAdminAction({
      adminId: session!.userId,
      action: "city.create",
      entityType: "city",
      entityId: created.id,
      metadata: { slug: created.slug, status: created.status },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/cities POST] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to create city." },
      { status: 500 },
    );
  }
}
