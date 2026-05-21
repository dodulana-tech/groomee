import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { getProductUsageStats } from "@/lib/inventory";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(180, Number(searchParams.get("days") ?? 30)));
  const stats = await getProductUsageStats(id, days);
  return NextResponse.json({ data: stats });
}
