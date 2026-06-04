import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelEnrolment } from "@/lib/benefits";
import { notifyProBenefitCancelled } from "@/lib/whatsapp";

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
  const reason = typeof body.reason === "string" ? body.reason : "Cancelled by admin";

  const updated = await cancelEnrolment(id, reason, session!.userId);

  try {
    const enr = await db.proBenefitEnrollment.findUnique({
      where: { id },
      include: { pro: { select: { phone: true } }, plan: { select: { name: true } } },
    });
    if (enr?.pro?.phone && enr.plan?.name) {
      await notifyProBenefitCancelled(enr.pro.phone, enr.plan.name);
    }
  } catch (err) {
    console.error("[benefits] cancel notify failed", err);
  }

  return NextResponse.json({ success: true, data: updated });
}
