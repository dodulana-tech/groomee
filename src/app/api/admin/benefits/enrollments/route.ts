import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrolPro } from "@/lib/benefits";
import { notifyProBenefitEnrolled } from "@/lib/whatsapp";

const VALID_STATUSES = new Set(["PENDING", "ACTIVE", "GRACE", "PAUSED", "CANCELLED"]);

// GET /api/admin/benefits/enrollments?status=ACTIVE&planId=...&q=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const planId = searchParams.get("planId");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (status && VALID_STATUSES.has(status)) where.status = status;
  if (planId) where.planId = planId;
  if (q) {
    where.pro = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    };
  }

  const rows = await db.proBenefitEnrollment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      pro: { select: { id: true, name: true, phone: true } },
      plan: { select: { id: true, name: true, monthlyPremium: true } },
    },
  });
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/admin/benefits/enrollments
// Body: { proId, planId, externalPolicyNo?, notes?, debitNow?, skipEligibility? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.proId || !body.planId) {
    return NextResponse.json(
      { success: false, error: "proId and planId required" },
      { status: 400 },
    );
  }

  const result = await enrolPro(body.proId, body.planId, session!.userId, {
    externalPolicyNo: body.externalPolicyNo ?? null,
    notes: body.notes ?? null,
    debitNow: !!body.debitNow,
    skipEligibility: !!body.skipEligibility,
  });

  if (!result.enrollment) {
    return NextResponse.json(
      {
        success: false,
        error: "Not eligible",
        reasons: result.eligibility?.reasons ?? [],
        details: result.eligibility?.details,
      },
      { status: 400 },
    );
  }

  // Notification
  try {
    const pro = await db.pro.findUnique({
      where: { id: body.proId },
      select: { phone: true },
    });
    const plan = await db.benefitPlan.findUnique({
      where: { id: body.planId },
      select: { name: true, monthlyPremium: true },
    });
    if (pro?.phone && plan) {
      await notifyProBenefitEnrolled(
        pro.phone,
        plan.name,
        result.debit?.amountDebited ?? plan.monthlyPremium,
        result.enrollment.nextDebitAt,
      );
    }
  } catch (err) {
    console.error("[benefits] enrol notify failed", err);
  }

  return NextResponse.json({ success: true, data: result });
}
