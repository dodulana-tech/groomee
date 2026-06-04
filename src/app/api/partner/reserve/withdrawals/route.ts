import { NextRequest, NextResponse } from "next/server";
import type { Prisma, SavingsWithdrawalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requestWithdrawal } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

const STATUSES: SavingsWithdrawalStatus[] = [
  "PENDING",
  "ELIGIBLE",
  "PAID",
  "CANCELLED",
  "FAILED",
];

// GET /api/partner/reserve/withdrawals?status=...
// Lists the session pro's withdrawals, scoped server-side. If status omitted,
// returns all statuses ordered desc.
export async function GET(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: Prisma.SavingsWithdrawalWhereInput = { proId };
  if (status && STATUSES.includes(status as SavingsWithdrawalStatus)) {
    where.status = status as SavingsWithdrawalStatus;
  }
  try {
    const rows = await db.savingsWithdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[partner/reserve/withdrawals GET]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// POST /api/partner/reserve/withdrawals
// Body: { amountRequested: number, kind: "notice" | "instant", note?: string }
//
// Validates amount + opt-in + available balance. The lib's requestWithdrawal
// re-checks balance inside a transaction so the race window is closed even
// if the pro tabs two requests in parallel.
export async function POST(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const body = await req.json().catch(() => ({}));
  const rawAmount = body?.amountRequested;
  const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount));
  const kind = body?.kind;
  const note = typeof body?.note === "string" ? body.note.slice(0, 240) : undefined;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "Amount must be a positive number" },
      { status: 400 },
    );
  }
  if (kind !== "notice" && kind !== "instant") {
    return NextResponse.json(
      { success: false, error: "kind must be 'notice' or 'instant'" },
      { status: 400 },
    );
  }

  // Pre-check available balance to give a clean error before the lib runs its
  // own in-tx check. The lib's check remains the source of truth.
  const account = await db.proSavingsAccount.findUnique({ where: { proId } });
  if (!account) {
    return NextResponse.json(
      { success: false, error: "No Reserve account found" },
      { status: 404 },
    );
  }
  if (amount > account.balanceAvailable + 0.001) {
    return NextResponse.json(
      {
        success: false,
        error: `Amount exceeds your available Reserve (₦${account.balanceAvailable.toFixed(2)}).`,
      },
      { status: 400 },
    );
  }

  try {
    const isInstant = kind === "instant";
    const result = await requestWithdrawal(proId, amount, isInstant, { notes: note });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[partner/reserve/withdrawals POST]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
