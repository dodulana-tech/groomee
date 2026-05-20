import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_PERMISSIONS } from "@/lib/health";

const PAGE_SIZE = 50;

// GET /api/admin/health/access-logs?cursor=<id>
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
    const cursor = searchParams.get("cursor")?.trim() || undefined;

    const rows = await db.healthAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      include: {
        profile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, phone: true } },
          },
        },
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
      data: items,
      nextCursor,
    });
  } catch (err) {
    console.error("[admin/health/access-logs GET] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
