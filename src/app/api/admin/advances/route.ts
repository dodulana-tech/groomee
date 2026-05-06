import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;

// GET /api/admin/advances?status=PENDING&page=1
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "advances.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);

  const where: { status?: string } = {};
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    db.proAdvance.findMany({
      where,
      include: { pro: { select: { id: true, name: true, phone: true, bankName: true, bankAccount: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.proAdvance.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows,
    meta: { total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) },
  });
}
