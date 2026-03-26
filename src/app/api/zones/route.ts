import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const zones = await db.zone.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: zones });
}
