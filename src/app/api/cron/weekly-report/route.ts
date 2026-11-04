import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendWeeklyReport } from "@/lib/admin-report";

// Called Mondays at 06:00 UTC (07:00 WAT) by Render Cron.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = (authHeader ?? "").replace("Bearer ", "");
  const expected = process.env.CRON_SECRET ?? "";
  const isValid =
    expected.length > 0 &&
    secret.length === expected.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyReport();
  return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
}
