import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadActivationChecklist } from "@/lib/pro-onboarding";

// GET /api/partner/activation — the post-approval "get bookable" checklist.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const pro = await db.pro.findFirst({ where: { userId: session.userId }, select: { id: true } });
  if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });
  const checklist = await loadActivationChecklist(pro.id);
  return NextResponse.json({ success: true, data: checklist });
}
