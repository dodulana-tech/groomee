import { NextRequest, NextResponse } from "next/server";
import { getSession, hasAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/activity?entityType=...&entityId=...&adminId=...&page=1
// Returns the most recent admin actions, newest first. Paginated.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasAnyPermission(session, "activity.view", "team.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(url.searchParams.get("pageSize") ?? "30") || 30),
    );
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const adminId = url.searchParams.get("adminId");
    const actionPrefix = url.searchParams.get("action");

    const where: {
      entityType?: string;
      entityId?: string;
      adminId?: string;
      action?: { startsWith: string };
    } = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (adminId) where.adminId = adminId;
    if (actionPrefix) where.action = { startsWith: actionPrefix };

    const [total, rows] = await Promise.all([
      db.activityLog.count({ where }),
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: { select: { id: true, name: true, phone: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("activity GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch activity" }, { status: 500 });
  }
}
