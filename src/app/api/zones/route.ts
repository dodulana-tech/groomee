import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const zones = await db.zone.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: zones }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
