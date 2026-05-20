import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_PERMISSIONS, writeAccessLog } from "@/lib/health";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/health/profiles/[userId]
// Returns the customer's HealthProfile + conditions. Writes a HealthAccessLog
// row (PHI audit) AND an ActivityLog row (admin-action audit) for every read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const session = await getSession();
    if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const profile = await db.healthProfile.findUnique({
      where: { userId },
      include: {
        conditions: { orderBy: { createdAt: "asc" } },
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "No health profile for this user" },
        { status: 404 },
      );
    }

    // Audit trail: both the PHI-specific access log and the generic
    // ActivityLog. Best-effort — never block the read on a logging failure.
    try {
      await writeAccessLog(
        profile.id,
        "ADMIN",
        session!.userId,
        "admin_view",
      );
    } catch (err) {
      console.error("[admin/health/profiles GET] access-log failed", err);
    }
    await logAdminAction({
      adminId: session!.userId,
      action: "health.view_profile",
      entityType: "health_profile",
      entityId: profile.id,
      metadata: { userId: profile.userId, conditionCount: profile.conditions.length },
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("[admin/health/profiles GET] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
