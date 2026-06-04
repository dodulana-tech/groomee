import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { lowStockSummary } from "@/lib/inventory";

/**
 * System-wide low-stock list (one row per pro+product currently below
 * its low-stock threshold). Optional ?proId= to scope to a single pro.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "inventory.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const proId = searchParams.get("proId") ?? undefined;

  const rows = await lowStockSummary(proId);
  return NextResponse.json({ data: rows, total: rows.length });
}
