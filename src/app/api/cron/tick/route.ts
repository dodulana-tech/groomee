import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import autoConfirm from "@/lib/auto-confirm";

// Called every 5 minutes by Vercel Cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const staleCompleted = await db.booking.findMany({
    where: { status: "COMPLETED", completedAt: { lte: twoHoursAgo } },
    select: { id: true },
  });

  for (const b of staleCompleted) {
    await autoConfirm(b.id);
  }

  await db.booking.updateMany({
    where: { status: "DISPATCHING", createdAt: { lte: fifteenMinsAgo } },
    data: { status: "NO_GROOMER" },
  });

  return NextResponse.json({
    ok: true,
    autoConfirmed: staleCompleted.length,
    timestamp: now.toISOString(),
  });
}
