import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma, WalletMovementType } from "@prisma/client";

const ALLOWED_TYPES: WalletMovementType[] = [
  "MOBILIZATION",
  "COMPLETION_RELEASE",
  "CONFIRM_RELEASE",
  "APPRENTICE_COMMISSION_RELEASE",
  "CLAWBACK",
  "ADVANCE_DISBURSED",
  "ADVANCE_REPAYMENT",
  "PAYOUT_DEBIT",
  "PAYOUT_REVERSAL",
  "MANUAL_ADJUSTMENT",
  "SAVINGS_SKIM",
  "BENEFIT_PREMIUM",
];

// GET /api/admin/wallet/[proId]/ledger.csv?type=&from=&to=
//
// Streams a CSV of every ledger row for the pro (cap 20k). Same filter
// surface as the system-wide movements endpoint, scoped to one pro.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "wallet.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { proId } = await params;
  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true, phone: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "Pro not found" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.WalletLedgerWhereInput = { proId };
  if (typeParam && ALLOWED_TYPES.includes(typeParam as WalletMovementType)) {
    where.type = typeParam as WalletMovementType;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) (where.createdAt as { gte?: Date }).gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        (where.createdAt as { lte?: Date }).lte = d;
      }
    }
  }

  try {
    const rows = await db.walletLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20_000,
    });
    const bookingIds = Array.from(
      new Set(rows.map((r) => r.bookingId).filter(Boolean)),
    ) as string[];
    const bookings = bookingIds.length
      ? await db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, reference: true },
        })
      : [];
    const bookingRefMap = new Map(bookings.map((b) => [b.id, b.reference]));

    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "createdAt",
      "type",
      "amount",
      "balanceAfter",
      "bookingRef",
      "advanceId",
      "payoutId",
      "sourceProId",
      "apprenticeshipId",
      "note",
      "idempotencyKey",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.type,
        r.amount.toFixed(2),
        r.balanceAfter.toFixed(2),
        r.bookingId ? bookingRefMap.get(r.bookingId) ?? r.bookingId : "",
        r.advanceId ?? "",
        r.payoutId ?? "",
        r.sourceProId ?? "",
        r.apprenticeshipId ?? "",
        r.note ?? "",
        r.idempotencyKey ?? "",
      ]
        .map(escape)
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const safeName = pro.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wallet-${safeName}-${stamp}.csv"`,
      },
    });
  } catch (err) {
    console.error("wallet ledger csv error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to export ledger" },
      { status: 500 },
    );
  }
}
