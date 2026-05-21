import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClaim } from "@/lib/benefits";
import { notifyProBenefitClaimOpened } from "@/lib/whatsapp";

const VALID_STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]);
const VALID_KINDS = new Set(["HMO", "ACCIDENT", "BUNDLE"]);

// GET /api/admin/benefits/claims?status=OPEN
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status && VALID_STATUSES.has(status)) where.status = status;
  const claims = await db.benefitClaim.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      pro: { select: { id: true, name: true, phone: true } },
      enrollment: {
        select: {
          id: true,
          plan: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ success: true, data: claims });
}

// POST /api/admin/benefits/claims
// Body: { enrollmentId, kind, summary, externalRef? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  if (
    !body.enrollmentId ||
    !VALID_KINDS.has(body.kind) ||
    typeof body.summary !== "string" ||
    !body.summary.trim()
  ) {
    return NextResponse.json(
      { success: false, error: "enrollmentId, kind, summary required" },
      { status: 400 },
    );
  }
  const claim = await createClaim(
    body.enrollmentId,
    body.kind,
    body.summary.trim(),
    session!.userId,
    body.externalRef ?? null,
  );

  try {
    const enr = await db.proBenefitEnrollment.findUnique({
      where: { id: body.enrollmentId },
      include: {
        pro: { select: { phone: true } },
        plan: { select: { name: true } },
      },
    });
    if (enr?.pro?.phone && enr.plan?.name) {
      await notifyProBenefitClaimOpened(
        enr.pro.phone,
        enr.plan.name,
        claim.externalRef ?? null,
      );
    }
  } catch (err) {
    console.error("[benefits] claim notify failed", err);
  }

  return NextResponse.json({ success: true, data: claim });
}
