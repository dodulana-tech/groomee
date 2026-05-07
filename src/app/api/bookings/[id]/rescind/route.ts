import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyApprenticeDeploymentRescinded } from "@/lib/whatsapp";
import { emailApprenticeDeploymentRescinded } from "@/lib/email-notify";

/**
 * Master rescinds a deployment that hasn't moved past ACCEPTED yet. Booking
 * goes back to the master, dependent goes ONLINE, dependent gets a polite
 * "no strike, no penalty" notification.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const master = await db.pro.findFirst({
      where: { userId: session.userId },
    });
    if (!master) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 404 },
      );
    }

    const booking = await db.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    // Booking must currently be held by a dependent of the caller.
    if (!booking.proId) {
      return NextResponse.json(
        { success: false, error: "Booking has no assigned pro." },
        { status: 422 },
      );
    }
    if (booking.proId === master.id) {
      return NextResponse.json(
        {
          success: false,
          error: "This booking is already with you — nothing to rescind.",
        },
        { status: 422 },
      );
    }

    const dependent = await db.pro.findUnique({
      where: { id: booking.proId },
      include: { user: { select: { email: true } } },
    });
    if (!dependent) {
      return NextResponse.json(
        { success: false, error: "Current pro not found" },
        { status: 404 },
      );
    }
    if (dependent.parentProId !== master.id) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only rescind deployments to your own team.",
        },
        { status: 403 },
      );
    }

    // Status must still be ACCEPTED — once they're EN_ROUTE+ it's too late.
    if (booking.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          success: false,
          error: `Too late to rescind — ${dependent.name} is already ${booking.status.toLowerCase().replace(/_/g, " ")}.`,
        },
        { status: 422 },
      );
    }

    // Master must not be busy on another live booking.
    if (master.availability === "BUSY" && master.currentBookingId !== null) {
      return NextResponse.json(
        {
          success: false,
          error: "You are currently busy on another booking.",
        },
        { status: 422 },
      );
    }

    // ─── Atomic reverse ───────────────────────────────────────────────────────
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          proId: master.id,
          // Clear the delegation snapshot — the booking is back with the
          // master and earnings should not split.
          delegatedApprenticeshipId: null,
        },
      });
      await tx.pro.update({
        where: { id: dependent.id },
        data: { availability: "ONLINE", currentBookingId: null },
      });
      await tx.pro.update({
        where: { id: master.id },
        data: { availability: "BUSY", currentBookingId: booking.id },
      });
    });

    // ─── Notify the dependent ─────────────────────────────────────────────────
    if (dependent.phone) {
      notifyApprenticeDeploymentRescinded({
        apprenticePhone: dependent.phone,
        masterName: master.name,
      }).catch((err) =>
        console.error("[rescind] apprentice WA failed:", err),
      );
    }
    if (dependent.user?.email) {
      emailApprenticeDeploymentRescinded({
        to: dependent.user.email,
        apprenticeName: dependent.name,
        masterName: master.name,
      }).catch((err) =>
        console.error("[rescind] apprentice email failed:", err),
      );
    }

    return NextResponse.json({
      success: true,
      data: { bookingId: booking.id, masterId: master.id },
    });
  } catch (err) {
    console.error("[bookings/[id]/rescind] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to rescind deployment" },
      { status: 500 },
    );
  }
}
