import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { checkEnrolmentEligibility } from "@/lib/benefits";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { proId } = await params;
  const planId = new URL(req.url).searchParams.get("planId");
  if (!planId) {
    return NextResponse.json(
      { success: false, error: "planId query param required" },
      { status: 400 },
    );
  }
  const result = await checkEnrolmentEligibility(proId, planId);
  return NextResponse.json({ success: true, data: result });
}
