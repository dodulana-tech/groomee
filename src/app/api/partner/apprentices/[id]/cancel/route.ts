import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyApprenticeInviteCancelled } from "@/lib/whatsapp";

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
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const master = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!master) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });
    }

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      include: {
        apprentice: { select: { id: true, name: true, phone: true } },
        master: { select: { id: true, name: true } },
      },
    });
    if (!apprenticeship) {
      return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
    }

    if (apprenticeship.masterId !== master.id) {
      return NextResponse.json(
        { success: false, error: "You can only cancel invitations you sent." },
        { status: 403 },
      );
    }
    if (apprenticeship.status !== "PENDING_ACCEPT") {
      return NextResponse.json(
        { success: false, error: "Only pending invitations can be cancelled." },
        { status: 409 },
      );
    }

    await db.apprenticeship.update({
      where: { id: apprenticeship.id },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(),
        terminationReason: "cancelled by master",
      },
    });

    if (apprenticeship.apprentice.phone) {
      notifyApprenticeInviteCancelled(
        apprenticeship.apprentice.phone,
        apprenticeship.master.name,
      ).catch((err) => console.error("[cancel] apprentice WA failed:", err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/apprentices/cancel] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to cancel invitation." },
      { status: 500 },
    );
  }
}
