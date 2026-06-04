import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cancelWithdrawal } from "@/lib/savings";
import { requireSessionPro } from "../../../_shared";

// POST /api/partner/reserve/withdrawals/[id]/cancel
//
// Pros may cancel their own PENDING withdrawals. ELIGIBLE rows are inside the
// payout window and should not be unwound from the pro side. Ownership is
// asserted by loading the row and checking proId before delegating to the
// shared cancelWithdrawal helper.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const { id } = await params;
  const w = await db.savingsWithdrawal.findUnique({ where: { id } });
  if (!w) {
    return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });
  }
  if (w.proId !== proId) {
    // Don't leak existence; the pro doesn't own this row.
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (w.status === "CANCELLED") {
    return NextResponse.json({ success: true, data: w });
  }
  if (w.status !== "PENDING") {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot cancel a withdrawal in status ${w.status}. Please contact support.`,
      },
      { status: 409 },
    );
  }

  try {
    const result = await cancelWithdrawal(id, {
      note: "Cancelled by pro from the partner portal",
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[partner/reserve/withdrawals/cancel]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
