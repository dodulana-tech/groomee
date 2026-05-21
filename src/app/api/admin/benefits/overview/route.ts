import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/benefits/overview — KPIs for the overview dashboard.
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const [
    activeCount,
    graceCount,
    pausedCount,
    cancelledCount,
    pendingCount,
    enrolments,
    openClaims,
    plans,
  ] = await Promise.all([
    db.proBenefitEnrollment.count({ where: { status: "ACTIVE" } }),
    db.proBenefitEnrollment.count({ where: { status: "GRACE" } }),
    db.proBenefitEnrollment.count({ where: { status: "PAUSED" } }),
    db.proBenefitEnrollment.count({ where: { status: "CANCELLED" } }),
    db.proBenefitEnrollment.count({ where: { status: "PENDING" } }),
    db.proBenefitEnrollment.findMany({
      where: { status: { in: ["ACTIVE", "GRACE"] } },
      include: { plan: { select: { monthlyPremium: true } } },
    }),
    db.benefitClaim.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.benefitPlan.count({ where: { isActive: true } }),
  ]);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [thisMonthDebits, thisMonthCancellations] = await Promise.all([
    db.benefitDebit.findMany({
      where: { createdAt: { gte: monthStart }, status: "SUCCESS" },
      select: { amountDebited: true, premiumGross: true, subsidyAmount: true },
    }),
    db.proBenefitEnrollment.count({
      where: { status: "CANCELLED", cancelledAt: { gte: monthStart } },
    }),
  ]);

  const monthlyRevenueGross = thisMonthDebits.reduce(
    (s, d) => s + d.amountDebited,
    0,
  );
  const monthlySubsidyCost = thisMonthDebits.reduce(
    (s, d) => s + d.subsidyAmount,
    0,
  );

  // churn rate (this month): cancellations / (cancellations + active+grace)
  const denom = thisMonthCancellations + activeCount + graceCount;
  const churnRate = denom > 0 ? thisMonthCancellations / denom : 0;

  // expected monthly run-rate from current active+grace enrolments
  const expectedMonthlyRevenue = enrolments.reduce(
    (s, e) => s + e.plan.monthlyPremium,
    0,
  );

  return NextResponse.json({
    success: true,
    data: {
      counts: {
        active: activeCount,
        grace: graceCount,
        paused: pausedCount,
        cancelled: cancelledCount,
        pending: pendingCount,
      },
      claims: { open: openClaims },
      plans: { active: plans },
      money: {
        monthlyRevenueGross,
        monthlySubsidyCost,
        expectedMonthlyRevenue,
      },
      churnThisMonth: churnRate,
    },
  });
}
