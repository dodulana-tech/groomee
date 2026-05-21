import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/benefits/debits
// Returns recent debit rows (each is a single enrolment × period attempt).
// Grouped client-side by period for the "monthly run log" presentation.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const where: Record<string, unknown> = {};
  if (period) where.period = period;

  const rows = await db.benefitDebit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      enrollment: {
        select: {
          id: true,
          pro: { select: { id: true, name: true, phone: true } },
          plan: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Build period summary
  const byPeriod = new Map<
    string,
    {
      period: string;
      attempted: number;
      succeeded: number;
      insufficient: number;
      failed: number;
      skipped: number;
      grossDebited: number;
    }
  >();
  for (const r of rows) {
    const s = byPeriod.get(r.period) ?? {
      period: r.period,
      attempted: 0,
      succeeded: 0,
      insufficient: 0,
      failed: 0,
      skipped: 0,
      grossDebited: 0,
    };
    s.attempted += 1;
    if (r.status === "SUCCESS") {
      s.succeeded += 1;
      s.grossDebited += r.amountDebited;
    } else if (r.status === "INSUFFICIENT_FUNDS") s.insufficient += 1;
    else if (r.status === "FAILED") s.failed += 1;
    else if (r.status === "SKIPPED") s.skipped += 1;
    byPeriod.set(r.period, s);
  }
  const periods = Array.from(byPeriod.values()).sort((a, b) =>
    b.period.localeCompare(a.period),
  );

  return NextResponse.json({ success: true, data: { periods, rows } });
}
