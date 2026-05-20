import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission, formatPhone, isValidEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADMIN_CAP, countAdmins, logAdminAction } from "@/lib/admin-audit";

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
        lastActiveAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: admins,
      meta: { count: admins.length, cap: ADMIN_CAP },
    });
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

    const { name, phone: rawPhone, email: rawEmail, roleId } = await req.json();

    if (!name || !rawPhone || !roleId) {
      return NextResponse.json(
        { success: false, error: "Name, phone, and role are required" },
        { status: 400 },
      );
    }

    const phone = formatPhone(rawPhone);
    const email =
      rawEmail && typeof rawEmail === "string" && rawEmail.trim()
        ? rawEmail.toLowerCase().trim()
        : null;
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address" },
        { status: 400 },
      );
    }

    // Verify the role exists
    const role = await db.adminRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    const existing = await db.user.findUnique({ where: { phone } });
    const isAlreadyAdmin = existing?.role === "ADMIN";

    // Enforce the team-size cap. Upgrading an existing admin is fine —
    // they're already in the count. Adding a brand-new admin counts.
    if (!isAlreadyAdmin) {
      const current = await countAdmins();
      if (current >= ADMIN_CAP) {
        return NextResponse.json(
          {
            success: false,
            error: `Admin team is at capacity (${ADMIN_CAP}). Remove a member before inviting another.`,
          },
          { status: 409 },
        );
      }
    }

    if (isAlreadyAdmin) {
      return NextResponse.json(
        { success: false, error: "This phone number is already an admin" },
        { status: 409 },
      );
    }

    // If the email is already taken by another account, fail loudly rather
    // than silently dropping it — admin emails matter for sign-in.
    if (email) {
      const emailTaken = await db.user.findFirst({
        where: { email, ...(existing ? { id: { not: existing.id } } : {}) },
        select: { id: true },
      });
      if (emailTaken) {
        return NextResponse.json(
          { success: false, error: "That email is already on another account" },
          { status: 409 },
        );
      }
    }

    let user;
    if (existing) {
      // Upgrade existing customer to admin.
      user = await db.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          adminRoleId: roleId,
          name: name.trim(),
          ...(email ? { email } : {}),
        },
        include: { adminRole: { select: { id: true, name: true } } },
      });
    } else {
      user = await db.user.create({
        data: {
          phone,
          name: name.trim(),
          role: "ADMIN",
          adminRoleId: roleId,
          ...(email ? { email } : {}),
        },
        include: { adminRole: { select: { id: true, name: true } } },
      });
    }

    await logAdminAction({
      adminId: session!.userId,
      action: "team.invite",
      entityType: "user",
      entityId: user.id,
      metadata: { roleId, roleName: role.name, upgradedExisting: Boolean(existing) },
    });

    // Best-effort invite email. Don't block the response on it.
    if (user.email) {
      (async () => {
        try {
          const [{ sendEmail }, { adminInviteEmail }] = await Promise.all([
            import("@/lib/email"),
            import("@/lib/email-templates"),
          ]);
          const inviter = await db.user.findUnique({
            where: { id: session!.userId },
            select: { name: true },
          });
          const { subject, html } = adminInviteEmail({
            inviteeName: user.name ?? "",
            inviterName: inviter?.name ?? null,
            roleName: role.name,
          });
          await sendEmail({ to: user.email!, subject, html });
        } catch (err) {
          console.error("admin invite email failed", err);
        }
      })();
    }

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    console.error("team POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to invite team member" }, { status: 500 });
  }
}
