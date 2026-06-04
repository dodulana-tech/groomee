import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { WalletMovementType } from "@prisma/client";

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

// GET /api/admin/wallet/[proId]?type=...&page=1&limit=50
//
// Returns the pro's wallet row + a paginated slice of their ledger. Filter
// by movement type with ?type=MOBILIZATION etc.
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
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    200,
    Math.max(10, parseInt(url.searchParams.get("limit") ?? "50") || 50),
  );

  const where: { proId: string; type?: WalletMovementType } = { proId };
  if (typeParam && ALLOWED_TYPES.includes(typeParam as WalletMovementType)) {
    where.type = typeParam as WalletMovementType;
  }

  try {
    const [pro, wallet, rows, total] = await Promise.all([
      db.pro.findUnique({
        where: { id: proId },
        select: { id: true, name: true, phone: true, status: true },
      }),
      db.proWallet.findUnique({ where: { proId } }),
      db.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // bookingRef for the linked booking, when present.
          // We don't have a relation on WalletLedger.bookingId, so fetch
          // references in a follow-up grouped query below.
        },
      }),
      db.walletLedger.count({ where }),
    ]);

    if (!pro) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 404 },
      );
    }

    // Resolve booking references for the visible rows in one extra query.
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

    return NextResponse.json({
      success: true,
      data: {
        pro,
        wallet: wallet ?? null,
        ledger: rows.map((r) => ({
          ...r,
          bookingRef: r.bookingId ? bookingRefMap.get(r.bookingId) ?? null : null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (err) {
    console.error("wallet detail error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load wallet detail" },
      { status: 500 },
    );
  }
}
