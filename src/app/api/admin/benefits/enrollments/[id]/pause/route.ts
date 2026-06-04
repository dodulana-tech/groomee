import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { pauseEnrolment } from "@/lib/benefits";
import { notifyProBenefitPaused } from "@/lib/whatsapp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : "Paused by admin";

  const updated = await pauseEnrolment(id, reason, session!.userId);

  try {
    const enr = await db.proBenefitEnrollment.findUnique({
      where: { id },
      include: { pro: { select: { phone: true } }, plan: { select: { name: true } } },
    });
    if (enr?.pro?.phone && enr.plan?.name) {
      const settings = await db.setting.findUnique({
        where: { key: "BENEFITS_PAUSE_DAYS" },
      });
      const days = Number(settings?.value) || 30;
      await notifyProBenefitPaused(enr.pro.phone, enr.plan.name, days);
    }
  } catch (err) {
    console.error("[benefits] pause notify failed", err);
  }

  return NextResponse.json({ success: true, data: updated });
}
