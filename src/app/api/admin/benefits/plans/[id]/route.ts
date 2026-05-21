import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/benefits/plans/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const plan = await db.benefitPlan.findUnique({
    where: { id },
    include: {
      subsidyRules: true,
      enrollments: {
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { pro: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: plan });
}

// PUT /api/admin/benefits/plans/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.provider !== undefined) data.provider = body.provider;
  if (body.kind !== undefined) data.kind = body.kind;
  if (body.monthlyPremium !== undefined) data.monthlyPremium = Number(body.monthlyPremium);
  if (body.coverAmount !== undefined)
    data.coverAmount = body.coverAmount === null ? null : Number(body.coverAmount);
  if (body.description !== undefined) data.description = body.description;
  if (body.highlights !== undefined && Array.isArray(body.highlights))
    data.highlights = body.highlights;
  if (body.minBookings !== undefined) data.minBookings = Number(body.minBookings);
  if (body.minTenureDays !== undefined) data.minTenureDays = Number(body.minTenureDays);
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

  const plan = await db.benefitPlan.update({ where: { id }, data });
  await logAdminAction({
    adminId: session!.userId,
    action: "benefits.plan.update",
    entityType: "plan",
    entityId: id,
    metadata: data,
  });
  return NextResponse.json({ success: true, data: plan });
}

// DELETE — soft delete (isActive=false). Rejects if any non-cancelled
// enrolment still references the plan.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const liveEnrolments = await db.proBenefitEnrollment.count({
    where: { planId: id, status: { not: "CANCELLED" } },
  });
  if (liveEnrolments > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot deactivate: ${liveEnrolments} pro${liveEnrolments === 1 ? "" : "s"} still enrolled. Pause or cancel those first.`,
      },
      { status: 400 },
    );
  }
  const plan = await db.benefitPlan.update({
    where: { id },
    data: { isActive: false },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "benefits.plan.deactivate",
    entityType: "plan",
    entityId: id,
  });
  return NextResponse.json({ success: true, data: plan });
}
