import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TYPE_GROUPS, type WalletTypeGroup } from "@/lib/wallet-labels";
import type { Prisma } from "@prisma/client";

// GET /api/partner/wallet/ledger?cursor=&limit=&typeGroup=&from=&to=
//
// Paginated wallet history for the signed-in pro. `typeGroup` maps friendly
// group names (earnings / reserve / advances / payouts / insurance) to the
// underlying enum subsets. `cursor` is the createdAt of the last seen row
// (ISO string); we keyset-paginate by createdAt + id for stable ordering.
//
// Always scoped by proId derived from session — never trust a client-supplied
// proId.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 403 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const typeGroupRaw = url.searchParams.get("typeGroup") ?? "all";
    const typeGroup = (Object.keys(TYPE_GROUPS).includes(typeGroupRaw)
      ? typeGroupRaw
      : "all") as WalletTypeGroup;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: Prisma.WalletLedgerWhereInput = { proId: pro.id };
    const subset = TYPE_GROUPS[typeGroup];
    if (subset.length > 0) where.type = { in: subset };

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        // Treat `to` as end-of-day inclusive.
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (cursor) {
      const d = new Date(cursor);
      if (!isNaN(d.getTime())) createdAt.lt = d;
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    const rows = await db.walletLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;

    const bookingIds = Array.from(
      new Set(sliced.map((r) => r.bookingId).filter(Boolean)),
    ) as string[];
    const bookings = bookingIds.length
      ? await db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, reference: true },
        })
      : [];
    const refMap = new Map(bookings.map((b) => [b.id, b.reference]));

    const data = sliced.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      bookingId: r.bookingId,
      bookingRef: r.bookingId ? refMap.get(r.bookingId) ?? null : null,
      note: r.note,
      createdAt: r.createdAt,
    }));

    const nextCursor = hasMore ? sliced[sliced.length - 1].createdAt : null;

    return NextResponse.json({
      success: true,
      data: {
        rows: data,
        nextCursor,
        hasMore,
      },
    });
  } catch (err) {
    console.error("partner wallet ledger error:", err);
    return NextResponse.json(
      { success: false, error: "Failed" },
      { status: 500 },
    );
  }
}
