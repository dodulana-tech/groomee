import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;

// GET /api/admin/payouts/history?page=1&status=...&proId=...
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "payouts.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
    const status = url.searchParams.get("status");
    const proId = url.searchParams.get("proId");

    const where: { status?: string; proId?: string } = {};
    if (status) where.status = status;
    if (proId) where.proId = proId;

    const [rows, total] = await Promise.all([
      db.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          pro: { select: { id: true, name: true, phone: true } },
        },
      }),
      db.payout.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) },
    });
  } catch (err) {
    console.error("payouts history error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payout history" },
      { status: 500 },
    );
  }
}
