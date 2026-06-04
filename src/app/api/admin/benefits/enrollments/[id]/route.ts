import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/benefits/enrollments/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const enrolment = await db.proBenefitEnrollment.findUnique({
    where: { id },
    include: {
      pro: { select: { id: true, name: true, phone: true, totalJobs: true, avgRating: true } },
      plan: true,
      debits: { orderBy: { createdAt: "desc" } },
      claims: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!enrolment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  // Activity log timeline
  const activity = await db.activityLog.findMany({
    where: { entityType: { in: ["enrolment", "claim"] }, entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ success: true, data: { ...enrolment, activity } });
}
