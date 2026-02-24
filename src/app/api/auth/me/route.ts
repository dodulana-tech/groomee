import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSessionCookie, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/auth/me
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not authenticated." },
      { status: 401 },
    );
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ success: true, data: user });
}

// POST /api/auth/update-profile
export { updateProfile as POST };

async function updateProfile(req: NextRequest) {
  try {
    const session = await requireSession();
    const { name, email } = await req.json();

    const user = await db.user.update({
      where: { id: session.userId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(email ? { email: email.trim().toLowerCase() } : {}),
      },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Update failed." },
      { status: 500 },
    );
  }
}
