import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { slugify } from "@/lib/utils";

// GET /api/admin/benefits/plans
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const plans = await db.benefitPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      subsidyRules: true,
      _count: {
        select: {
          enrollments: { where: { status: { in: ["ACTIVE", "GRACE"] } } },
        },
      },
    },
  });
  return NextResponse.json({ success: true, data: plans });
}

// POST /api/admin/benefits/plans
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const slug = body.slug?.trim() || slugify(body.name ?? "");
    if (!slug || !body.name) {
      return NextResponse.json(
        { success: false, error: "Name and slug required" },
        { status: 400 },
      );
    }
    const plan = await db.benefitPlan.create({
      data: {
        name: body.name,
        slug,
        kind: body.kind ?? "BUNDLE",
        provider: body.provider ?? "",
        monthlyPremium: Number(body.monthlyPremium) || 0,
        coverAmount:
          body.coverAmount !== undefined && body.coverAmount !== null
            ? Number(body.coverAmount)
            : null,
        description: body.description ?? null,
        highlights: Array.isArray(body.highlights) ? body.highlights : [],
        minBookings: Number(body.minBookings) || 5,
        minTenureDays: Number(body.minTenureDays) || 30,
        isActive: body.isActive ?? true,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    await logAdminAction({
      adminId: session!.userId,
      action: "benefits.plan.create",
      entityType: "plan",
      entityId: plan.id,
      metadata: { name: plan.name, slug: plan.slug },
    });
    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    console.error("[benefits] plan create failed", err);
    return NextResponse.json(
      { success: false, error: "Failed to create plan" },
      { status: 500 },
    );
  }
}
