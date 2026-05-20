import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_PERMISSIONS } from "@/lib/health";

const PAGE_SIZE = 25;

// GET /api/admin/health/profiles?q=<phone-or-name>&cursor=<id>
//
// Lists health profiles that have at least one unresolved condition (the
// only ones interesting for care work). Searchable by customer name/phone.
// No PHI is leaked here — only summary counts + visibility — and reads are
// not access-logged because we don't return condition rows. The per-profile
// detail endpoint logs.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const cursor = searchParams.get("cursor")?.trim() || undefined;

    const where = {
      conditions: { some: { resolved: false } },
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            },
          }
        : {}),
    };

    const rows = await db.healthProfile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, phone: true } },
        _count: { select: { conditions: true } },
      },
    });

    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > PAGE_SIZE) {
      nextCursor = rows[PAGE_SIZE - 1].id;
      items = rows.slice(0, PAGE_SIZE);
    }

    return NextResponse.json({
      success: true,
      data: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        user: p.user,
        visibility: p.visibility,
        conditionCount: p._count.conditions,
        lastReviewedAt: p.lastReviewedAt,
        updatedAt: p.updatedAt,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error("[admin/health/profiles GET] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
