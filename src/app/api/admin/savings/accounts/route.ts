import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// GET /api/admin/savings/accounts?search=...&page=1
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const optedFilter = searchParams.get("optedIn"); // "true" | "false" | null
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 50;

    const where: Prisma.ProSavingsAccountWhereInput = {};
    if (optedFilter === "true") where.optedIn = true;
    if (optedFilter === "false") where.optedIn = false;
    if (search) {
      where.pro = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      db.proSavingsAccount.findMany({
        where,
        include: {
          pro: { select: { id: true, name: true, phone: true } },
          _count: { select: { movements: true, withdrawals: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.proSavingsAccount.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { rows, total, page, pageSize },
    });
  } catch (err) {
    console.error("[savings/accounts] error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
