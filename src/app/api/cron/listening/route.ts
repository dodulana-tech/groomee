import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runListening } from "@/lib/listening";

export const maxDuration = 300;

// Called hourly by Render Cron. Connectors self-throttle (Brave daily, X 6h).
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

  const result = await runListening();
  return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
}
