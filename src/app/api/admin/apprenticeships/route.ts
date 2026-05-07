import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";
import type { Prisma } from "@prisma/client";

const STATUS_VALUES = [
  "PENDING_ACCEPT",
  "IN_TRAINING",
  "READY_FOR_FREEDOM",
  "FREED",
  "TERMINATED",
] as const;

// GET /api/admin/apprenticeships?status=&masterId=&q=
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.view)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const masterId = searchParams.get("masterId")?.trim();
    const q = searchParams.get("q")?.trim();

    const where: Prisma.ApprenticeshipWhereInput = {};
    if (status && (STATUS_VALUES as readonly string[]).includes(status)) {
      where.status = status as (typeof STATUS_VALUES)[number];
    }
    if (masterId) {
      where.masterId = masterId;
    }
    if (q) {
      where.OR = [
        { apprentice: { name: { contains: q, mode: "insensitive" } } },
        { apprentice: { phone: { contains: q } } },
      ];
    }

    const apprenticeships = await db.apprenticeship.findMany({
      where,
      orderBy: { invitedAt: "desc" },
      include: {
        apprentice: {
          select: {
            id: true,
            name: true,
            phone: true,
            totalJobs: true,
            avgRating: true,
            relationship: true,
          },
        },
        master: { select: { id: true, name: true, phone: true } },
        _count: { select: { modules: true, earnings: true } },
      },
    });

    return NextResponse.json({ success: true, data: apprenticeships });
  } catch (err) {
    console.error("[admin/apprenticeships GET] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
