import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission, invalidateSessionCache } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// PATCH /api/admin/team/[id] — update team member's role or deactivate
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      include: { adminRole: { select: { id: true, slug: true, name: true, permissions: true } } },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Admin user not found" }, { status: 404 });
    }

    // Cannot modify your own role
    if (user.id === session!.userId) {
      return NextResponse.json(
        { success: false, error: "Cannot modify your own role" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const update: {
      adminRoleId?: string | null;
      name?: string;
      role?: "CUSTOMER";
      sessionsValidFrom?: Date;
    } = {};

    let action = "team.update";
    const meta: Record<string, unknown> = {};

    // If we're about to demote/remove a super-admin, make sure at least one
    // other super-admin remains. Losing all super-admins locks everyone out
    // of role management.
    const isLastSuperAdmin = async (): Promise<boolean> => {
      if (!user.adminRole?.permissions?.includes("*")) return false;
      const others = await db.user.count({
        where: {
          role: "ADMIN",
          id: { not: user.id },
          adminRole: { permissions: { has: "*" } },
        },
      });
      return others === 0;
    };

    if (body.roleId) {
      const role = await db.adminRole.findUnique({ where: { id: body.roleId } });
      if (!role) {
        return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
      }
      // Block if this would remove the last super-admin.
      if (!role.permissions.includes("*") && (await isLastSuperAdmin())) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Can't change the role of the last super-admin. Promote another admin to super-admin first.",
          },
          { status: 409 },
        );
      }
      update.adminRoleId = body.roleId;
      action = "team.role_change";
      meta.fromRoleId = user.adminRoleId;
      meta.toRoleId = body.roleId;
      meta.toRoleName = role.name;
      // Permission changes invalidate the user's existing JWT — their token
      // carries the *old* permissions until it expires (up to 30 days).
      update.sessionsValidFrom = new Date();
    }

    if (body.name && typeof body.name === "string") {
      update.name = body.name.trim();
      meta.nameChanged = true;
    }

    // Deactivate: demote to CUSTOMER (preserves the account)
    if (body.deactivate === true) {
      if (await isLastSuperAdmin()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Can't remove the last super-admin. Promote another admin to super-admin first.",
          },
          { status: 409 },
        );
      }
      update.role = "CUSTOMER";
      update.adminRoleId = null;
      update.sessionsValidFrom = new Date();
      action = "team.remove";
    }

    const updated = await db.user.update({
      where: { id },
      data: update,
      include: { adminRole: { select: { id: true, name: true } } },
    });

    // If we revoked the session, drop the cache entry so the next request
    // for that user picks up the new sessionsValidFrom immediately.
    if (update.sessionsValidFrom) {
      invalidateSessionCache(id);
    }

    await logAdminAction({
      adminId: session!.userId,
      action,
      entityType: "user",
      entityId: id,
      metadata: meta,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("team PATCH error:", err);
    return NextResponse.json({ success: false, error: "Failed to update team member" }, { status: 500 });
  }
}
