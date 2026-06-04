import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Prisma, InventoryTxnReason } from "@prisma/client";

// GET /api/partner/inventory/txns?productId&reason&cursor&limit
// Cursor-paginated transaction history for the signed-in pro. Optional
// filter by productId and / or reason. Cursor is the last seen txn id —
// rows are ordered by createdAt desc.
const VALID_REASONS: InventoryTxnReason[] = [
  "INITIAL_STOCK",
  "RESTOCK",
  "BOOKING_DECREMENT",
  "ADMIN_ADJUSTMENT",
  "WASTE",
  "CORRECTION",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const pro = await db.pro.findFirst({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!pro) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 403 },
      );
    }

    const url = req.nextUrl;
    const productId = url.searchParams.get("productId") ?? undefined;
    const reasonRaw = url.searchParams.get("reason") ?? undefined;
    const reason =
      reasonRaw && (VALID_REASONS as string[]).includes(reasonRaw)
        ? (reasonRaw as InventoryTxnReason)
        : undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1),
      100,
    );

    const where: Prisma.InventoryTxnWhereInput = { proId: pro.id };
    if (productId) where.productId = productId;
    if (reason) where.reason = reason;

    const rows = await db.inventoryTxn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        product: { select: { id: true, name: true, unit: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({
      success: true,
      data: {
        items: page.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          productId: r.productId,
          productName: r.product?.name ?? "—",
          unit: r.product?.unit ?? "",
          delta: r.delta,
          qtyAfter: r.qtyAfter,
          reason: r.reason,
          bookingId: r.bookingId,
          note: r.note,
        })),
        nextCursor,
      },
    });
  } catch (err) {
    console.error("partner inventory txns error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load history" },
      { status: 500 },
    );
  }
}
