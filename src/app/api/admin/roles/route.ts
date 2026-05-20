import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/roles — list all roles
export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const roles = await db.adminRole.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (err) {
    console.error("roles GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch roles" }, { status: 500 });
  }
}

// POST /api/admin/roles — create a new role
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "team.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { name, description, permissions } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Role name is required" }, { status: 400 });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ success: false, error: "At least one permission is required" }, { status: 400 });
    }

    // Don't allow creating roles with wildcard
    if (permissions.includes("*")) {
      return NextResponse.json({ success: false, error: "Cannot create roles with full access. Use Super Admin." }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const existing = await db.adminRole.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ success: false, error: "A role with this name already exists" }, { status: 409 });
    }

    const role = await db.adminRole.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        permissions,
        isSystem: false,
      },
    });

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (err) {
    console.error("roles POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to create role" }, { status: 500 });
  }
}
