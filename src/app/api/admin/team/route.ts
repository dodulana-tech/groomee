import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission, formatPhone } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/team — list all admin users
export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        adminRoleId: true,
        adminRole: { select: { id: true, name: true, slug: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: admins });
  } catch (err) {
    console.error("team GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch team" }, { status: 500 });
  }
}

// POST /api/admin/team — invite a new admin user
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { name, phone: rawPhone, roleId } = await req.json();

    if (!name || !rawPhone || !roleId) {
      return NextResponse.json(
        { success: false, error: "Name, phone, and role are required" },
        { status: 400 },
      );
    }

    const phone = formatPhone(rawPhone);

    // Verify the role exists
    const role = await db.adminRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing) {
      if (existing.role === "ADMIN") {
        return NextResponse.json(
          { success: false, error: "This phone number is already an admin" },
          { status: 409 },
        );
      }
      // Upgrade existing customer to admin
      const updated = await db.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", adminRoleId: roleId, name: name.trim() },
        include: { adminRole: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ success: true, data: updated }, { status: 201 });
    }

    // Create new admin user
    const user = await db.user.create({
      data: {
        phone,
        name: name.trim(),
        role: "ADMIN",
        adminRoleId: roleId,
      },
      include: { adminRole: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    console.error("team POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to invite team member" }, { status: 500 });
  }
}
