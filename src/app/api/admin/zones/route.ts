import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "catalog.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const zones = await db.zone.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: zones });
}
