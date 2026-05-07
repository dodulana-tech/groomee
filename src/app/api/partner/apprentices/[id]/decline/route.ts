import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyMasterInviteDeclined } from "@/lib/whatsapp";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      include: {
        apprentice: { select: { id: true, userId: true, phone: true, name: true } },
        master: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!apprenticeship) {
      return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
    }

    const matchesByUser =
      apprenticeship.apprentice.userId !== null &&
      apprenticeship.apprentice.userId === session.userId;
    const matchesByPhone =
      session.phone !== null && session.phone === apprenticeship.apprentice.phone;
    if (!matchesByUser && !matchesByPhone) {
      return NextResponse.json(
        { success: false, error: "This invitation belongs to someone else." },
        { status: 403 },
      );
    }

    if (apprenticeship.status !== "PENDING_ACCEPT") {
      return NextResponse.json(
        { success: false, error: "This invitation is no longer pending." },
        { status: 409 },
      );
    }

    await db.apprenticeship.update({
      where: { id: apprenticeship.id },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(),
        terminationReason: "declined by apprentice",
      },
    });

    if (apprenticeship.master.phone) {
      notifyMasterInviteDeclined(apprenticeship.master.phone, apprenticeship.apprentice.name).catch(
        (err) => console.error("[decline] master WA failed:", err),
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/apprentices/decline] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to decline invitation." },
      { status: 500 },
    );
  }
}
