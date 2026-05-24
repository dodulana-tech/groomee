import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelEnrolment } from "@/lib/benefits";
import { notifyProBenefitCancelled } from "@/lib/whatsapp";

const CANCELLABLE = new Set(["PENDING", "ACTIVE", "GRACE", "PAUSED"]);

// POST /api/partner/benefits/enrollments/[id]/cancel
// Body: { reason?: string }
//
// A pro can only cancel their own enrolment. Already CANCELLED enrolments
// are rejected so we don't double-fire notifications or audit entries.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    select: { id: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "No pro account on file" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const enrolment = await db.proBenefitEnrollment.findUnique({
    where: { id },
    include: { plan: { select: { name: true } }, pro: { select: { phone: true } } },
  });
  if (!enrolment) {
    return NextResponse.json(
      { success: false, error: "Enrolment not found" },
      { status: 404 },
    );
  }
  // Ownership check — scope by session pro id, never trust input.
  if (enrolment.proId !== pro.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  if (!CANCELLABLE.has(enrolment.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot cancel a ${enrolment.status} enrolment` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawReason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reason = rawReason ? `Self-cancelled: ${rawReason}`.slice(0, 240) : "Self-cancelled by pro";

  const updated = await cancelEnrolment(id, reason, session.userId);

  // Best-effort notification
  try {
    if (enrolment.pro.phone && enrolment.plan.name) {
      await notifyProBenefitCancelled(enrolment.pro.phone, enrolment.plan.name);
    }
  } catch (err) {
    console.error("[partner-benefits] cancel notify failed", err);
  }

  return NextResponse.json({ success: true, data: updated });
}
