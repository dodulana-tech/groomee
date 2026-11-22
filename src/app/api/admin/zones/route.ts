import { NextResponse } from "next/server";
import { getSession, hasAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  // pros.manage needs zones for the Add pro form.
  if (!hasAnyPermission(session, "catalog.view", "pros.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const zones = await db.zone.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: zones });
}
