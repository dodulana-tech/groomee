import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

const VALID_TIERS = new Set(["STANDARD", "PRO", "ELITE"]);

// PUT /api/admin/benefits/plans/[id]/subsidies
// Body: [{tier: "STANDARD"|"PRO"|"ELITE", pct: 0..1}, ...]
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
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Body must be an array of {tier, pct}" },
      { status: 400 },
    );
  }
  for (const row of body) {
    if (!VALID_TIERS.has(row.tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid tier: ${row.tier}` },
        { status: 400 },
      );
    }
    const pct = Number(row.pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
      return NextResponse.json(
        { success: false, error: `Invalid pct for ${row.tier}` },
        { status: 400 },
      );
    }
  }
  const plan = await db.benefitPlan.findUnique({ where: { id } });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  }

  for (const row of body) {
    await db.benefitSubsidyRule.upsert({
      where: { planId_proTier: { planId: id, proTier: row.tier } },
      update: { subsidyPct: Number(row.pct) },
      create: { planId: id, proTier: row.tier, subsidyPct: Number(row.pct) },
    });
  }

  await logAdminAction({
    adminId: session!.userId,
    action: "benefits.plan.subsidies",
    entityType: "plan",
    entityId: id,
    metadata: { rules: body },
  });

  const subsidies = await db.benefitSubsidyRule.findMany({ where: { planId: id } });
  return NextResponse.json({ success: true, data: subsidies });
}
