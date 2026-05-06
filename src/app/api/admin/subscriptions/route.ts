import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

// GET /api/admin/subscriptions?status=ACTIVE&q=...&page=1
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "subscriptions.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);

  const where: Prisma.SubscriptionWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [rows, total, summary] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        plan: { select: { id: true, name: true, price: true, credits: true } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.subscription.count({ where }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(summary.map((s) => [s.status, s._count._all]));

  return NextResponse.json({
    success: true,
    data: rows,
    meta: {
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
      byStatus,
    },
  });
}
