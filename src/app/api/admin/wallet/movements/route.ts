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

// GET /api/admin/wallet/movements
//   ?type=MOBILIZATION
//   &from=2024-01-01
//   &to=2024-01-31
//   &page=1&limit=50
//   &format=csv (optional — streams a CSV instead of JSON)
//
// System-wide ledger feed. Read-only.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "wallet.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = url.searchParams.get("format");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    500,
    Math.max(10, parseInt(url.searchParams.get("limit") ?? "50") || 50),
  );

  const where: Prisma.WalletLedgerWhereInput = {};
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
        // include the to-day fully
        d.setHours(23, 59, 59, 999);
        (where.createdAt as { lte?: Date }).lte = d;
      }
    }
  }

  try {
    if (format === "csv") {
      // For CSV we cap at 10k rows to keep memory bounded.
      const rows = await db.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10_000,
        include: {
          pro: { select: { id: true, name: true, phone: true } },
        },
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
        "proId",
        "proName",
        "proPhone",
        "type",
        "amount",
        "balanceAfter",
        "bookingRef",
        "advanceId",
        "payoutId",
        "note",
      ].join(",");
      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.proId,
          r.pro?.name ?? "",
          r.pro?.phone ?? "",
          r.type,
          r.amount.toFixed(2),
          r.balanceAfter.toFixed(2),
          r.bookingId ? bookingRefMap.get(r.bookingId) ?? r.bookingId : "",
          r.advanceId ?? "",
          r.payoutId ?? "",
          r.note ?? "",
        ]
          .map(escape)
          .join(","),
      );
      const csv = [header, ...lines].join("\n");
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wallet-movements-${stamp}.csv"`,
        },
      });
    }

    const [rows, total] = await Promise.all([
      db.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pro: { select: { id: true, name: true, phone: true } },
        },
      }),
      db.walletLedger.count({ where }),
    ]);

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
      data: rows.map((r) => ({
        ...r,
        bookingRef: r.bookingId ? bookingRefMap.get(r.bookingId) ?? null : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("wallet movements error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load movements" },
      { status: 500 },
    );
  }
}
