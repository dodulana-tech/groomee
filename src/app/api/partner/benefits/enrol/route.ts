import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrolPro, checkEnrolmentEligibility } from "@/lib/benefits";
import { notifyProBenefitEnrolled } from "@/lib/whatsapp";

// POST /api/partner/benefits/enrol
// Body: { planId: string }
//
// Self-service enrolment. We re-check eligibility server-side - the client
// is never trusted to attest to its own eligibility.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true, phone: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "No pro account on file" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) {
    return NextResponse.json(
      { success: false, error: "planId required" },
      { status: 400 },
    );
  }

  // Server-side eligibility re-check (don't trust the client)
  const eligibility = await checkEnrolmentEligibility(pro.id, planId);
  if (!eligibility.eligible) {
    return NextResponse.json(
      {
        success: false,
        error: "Not eligible",
        reasons: eligibility.reasons,
        details: eligibility.details,
      },
      { status: 400 },
    );
  }

  const result = await enrolPro(pro.id, planId, session.userId);
  if (!result.enrollment) {
    return NextResponse.json(
      {
        success: false,
        error: "Enrolment failed",
        reasons: result.eligibility?.reasons ?? [],
      },
      { status: 400 },
    );
  }

  // Best-effort notification
  try {
    const plan = await db.benefitPlan.findUnique({
      where: { id: planId },
      select: { name: true, monthlyPremium: true },
    });
    if (pro.phone && plan) {
      await notifyProBenefitEnrolled(
        pro.phone,
        plan.name,
        plan.monthlyPremium,
        result.enrollment.nextDebitAt,
      );
    }
  } catch (err) {
    console.error("[partner-benefits] enrol notify failed", err);
  }

  return NextResponse.json({ success: true, data: result.enrollment });
}
