import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/roles/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const role = await db.adminRole.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: role });
  } catch (err) {
    console.error("role GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch role" }, { status: 500 });
  }
}

// PATCH /api/admin/roles/[id] — update role name, description, or permissions
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
    const role = await db.adminRole.findUnique({ where: { id } });
    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    // Cannot edit the system Super Admin role's permissions
    if (role.isSystem) {
      return NextResponse.json(
        { success: false, error: "Cannot edit system roles. Create a new role instead." },
        { status: 400 },
      );
    }

    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (body.name && typeof body.name === "string") {
      update.name = body.name.trim();
      update.slug = body.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    }
    if (body.description !== undefined) {
      update.description = body.description?.trim() || null;
    }
    if (Array.isArray(body.permissions)) {
      if (body.permissions.includes("*")) {
        return NextResponse.json(
          { success: false, error: "Cannot assign full access to custom roles" },
          { status: 400 },
        );
      }
      update.permissions = body.permissions;
    }

    const updated = await db.adminRole.update({ where: { id }, data: update });
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("role PATCH error:", err);
    return NextResponse.json({ success: false, error: "Failed to update role" }, { status: 500 });
  }
}

// DELETE /api/admin/roles/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const role = await db.adminRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json({ success: false, error: "Cannot delete system roles" }, { status: 400 });
    }

    if (role._count.users > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete role with ${role._count.users} assigned user(s). Reassign them first.` },
        { status: 400 },
      );
    }

    await db.adminRole.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("role DELETE error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete role" }, { status: 500 });
  }
}
