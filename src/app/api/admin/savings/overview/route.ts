import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { getOverview } from "@/lib/savings";

// GET /api/admin/savings/overview
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const data = await getOverview();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[savings/overview] error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
