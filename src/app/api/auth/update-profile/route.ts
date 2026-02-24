import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { name, email } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name is required." },
        { status: 400 },
      );
    }

    const user = await db.user.update({
      where: { id: session.userId },
      data: {
        name: name.trim(),
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
