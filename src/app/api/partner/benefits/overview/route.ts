import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkEnrolmentEligibility,
  deriveProTier,
  type ProTier,
} from "@/lib/benefits";

// GET /api/partner/benefits/overview
//
// Returns the pro's current enrolment (if any) together with the list of
// active benefit plans, with subsidy preview + live eligibility result for
// each plan. Pros never see other pros' data.
export async function GET() {
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
    select: { id: true, totalJobs: true, avgRating: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "No pro account on file" },
      { status: 403 },
    );
  }

  const proTier = deriveProTier(pro);

  const [enrollment, plans] = await Promise.all([
    db.proBenefitEnrollment.findFirst({
      where: { proId: pro.id, status: { not: "CANCELLED" } },
      include: {
        plan: true,
        debits: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.benefitPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { subsidyRules: true },
    }),
  ]);

  // Subsidy preview per plan based on this pro's tier
  const planPreview = plans.map((plan) => {
    const rule = plan.subsidyRules.find((r) => r.proTier === proTier);
    const subsidyPct = rule?.subsidyPct ?? 0;
    const subsidyAmount = round2(plan.monthlyPremium * subsidyPct);
    const netDebit = round2(plan.monthlyPremium - subsidyAmount);
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      kind: plan.kind,
      provider: plan.provider,
      monthlyPremium: plan.monthlyPremium,
      coverAmount: plan.coverAmount,
      description: plan.description,
      highlights: plan.highlights,
      subsidyPct,
      subsidyAmount,
      netDebit,
    };
  });

  // Eligibility per plan (only if there's no active-ish enrolment on it).
  const eligibility = await Promise.all(
    plans.map(async (plan) => {
      const result = await checkEnrolmentEligibility(pro.id, plan.id);
      return {
        planId: plan.id,
        eligible: result.eligible,
        reasons: result.reasons,
        details: result.details,
      };
    }),
  );

  return NextResponse.json({
    success: true,
    data: {
      proTier: proTier as ProTier,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            activatedAt: enrollment.activatedAt,
            nextDebitAt: enrollment.nextDebitAt,
            lastDebitAt: enrollment.lastDebitAt,
            graceUntil: enrollment.graceUntil,
            pausedAt: enrollment.pausedAt,
            cancelledAt: enrollment.cancelledAt,
            externalPolicyNo: enrollment.externalPolicyNo,
            plan: enrollment.plan,
            debits: enrollment.debits,
          }
        : null,
      eligiblePlans: planPreview,
      eligibility,
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
