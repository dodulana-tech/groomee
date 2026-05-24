import { NextRequest, NextResponse } from "next/server";
import type { Prisma, SavingsMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSessionPro } from "../_shared";

// GET /api/partner/reserve/movements?cursor=&limit=&typeGroup=&from=&to=
//
// Paginated, scoped-to-the-session-pro movement list. Type groups collapse the
// SavingsMovementType enum into the four chips the partner UI shows:
//   skim       → SKIM
//   bonus      → MATCH_BONUS, INTEREST_CREDIT
//   withdrawal → WITHDRAWAL_REQUEST, WITHDRAWAL_RELEASED, WITHDRAWAL_CANCELLED,
//                EARLY_BREAK_PENALTY
//   adjust     → ADJUSTMENT, CLAWBACK
//
// Cursor is the movement id of the last row returned (createdAt-ordered desc).
const TYPE_GROUPS: Record<string, SavingsMovementType[]> = {
  skim: ["SKIM"],
  bonus: ["MATCH_BONUS", "INTEREST_CREDIT"],
  withdrawal: [
    "WITHDRAWAL_REQUEST",
    "WITHDRAWAL_RELEASED",
    "WITHDRAWAL_CANCELLED",
    "EARLY_BREAK_PENALTY",
  ],
  adjust: ["ADJUSTMENT", "CLAWBACK"],
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const { searchParams } = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT),
  );
  const cursor = searchParams.get("cursor");
  const typeGroup = searchParams.get("typeGroup");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.SavingsMovementWhereInput = { proId };
  if (typeGroup && TYPE_GROUPS[typeGroup]) {
    where.type = { in: TYPE_GROUPS[typeGroup] };
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) (where.createdAt as { gte?: Date }).gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) (where.createdAt as { lte?: Date }).lte = d;
    }
  }

  try {
    const rows = await db.savingsMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
    return NextResponse.json({
      success: true,
      data: { items, nextCursor, hasMore },
    });
  } catch (err) {
    console.error("[partner/reserve/movements]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
