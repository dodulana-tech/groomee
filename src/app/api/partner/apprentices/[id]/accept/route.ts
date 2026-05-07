import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyMasterInviteAccepted } from "@/lib/whatsapp";
import { emailInviteAccepted } from "@/lib/email-notify";

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
        master: { select: { id: true, name: true, phone: true, userId: true } },
      },
    });
    if (!apprenticeship) {
      return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
    }

    // Match the session to the apprentice. Either by userId (if Pro is linked)
    // or by the phone on the session matching the Pro's phone.
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

    if (apprenticeship.status === "IN_TRAINING") {
      return NextResponse.json(
        { success: false, error: "You have already accepted this invitation." },
        { status: 409 },
      );
    }
    if (apprenticeship.status !== "PENDING_ACCEPT") {
      return NextResponse.json(
        { success: false, error: "This invitation is no longer pending." },
        { status: 409 },
      );
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.apprenticeship.update({
        where: { id: apprenticeship.id },
        data: { status: "IN_TRAINING", acceptedAt: now },
      });
      // Auto-link the Pro to the user if not already linked, and set the relationship + parent.
      await tx.pro.update({
        where: { id: apprenticeship.apprentice.id },
        data: {
          parentProId: apprenticeship.master.id,
          relationship: "APPRENTICE",
          ...(apprenticeship.apprentice.userId === null
            ? { userId: session.userId }
            : {}),
        },
      });
    });

    // Notifications to the master.
    if (apprenticeship.master.phone) {
      notifyMasterInviteAccepted(apprenticeship.master.phone, apprenticeship.apprentice.name).catch(
        (err) => console.error("[accept] master WA failed:", err),
      );
    }
    if (apprenticeship.master.userId) {
      const masterUser = await db.user.findUnique({
        where: { id: apprenticeship.master.userId },
        select: { email: true },
      });
      if (masterUser?.email) {
        emailInviteAccepted({
          to: masterUser.email,
          apprenticeName: apprenticeship.apprentice.name,
        });
      }
    }

    return NextResponse.json({ success: true, data: { apprenticeshipId: apprenticeship.id } });
  } catch (err) {
    console.error("[partner/apprentices/accept] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to accept invitation." },
      { status: 500 },
    );
  }
}
