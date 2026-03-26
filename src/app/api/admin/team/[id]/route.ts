import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const user = await db.user.findUnique({ where: { id } });

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
    const update: Record<string, unknown> = {};

    if (body.roleId) {
      const role = await db.adminRole.findUnique({ where: { id: body.roleId } });
      if (!role) {
        return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
      }
      update.adminRoleId = body.roleId;
    }

    if (body.name && typeof body.name === "string") {
      update.name = body.name.trim();
    }

    // Deactivate: demote to CUSTOMER (preserves the account)
    if (body.deactivate === true) {
      update.role = "CUSTOMER";
      update.adminRoleId = null;
    }

    const updated = await db.user.update({
      where: { id },
      data: update,
      include: { adminRole: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("team PATCH error:", err);
    return NextResponse.json({ success: false, error: "Failed to update team member" }, { status: 500 });
  }
}
