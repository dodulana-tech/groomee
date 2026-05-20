import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import type { BookingStatus } from "@prisma/client";

const ALLOWED_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "DISPATCHING",
  "NO_GROOMER",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_SERVICE",
  "COMPLETED",
  "CONFIRMED",
  "CANCELLED",
  "DISPUTED",
];

// PATCH /api/admin/bookings/[id]
//
// Generic booking edit endpoint. Supports:
//   - { status: "...", reason: "..." }      → force a status change
//   - { forceComplete: true, reason }       → shortcut: jump straight to CONFIRMED
//
// Both require the `bookings.force_complete` permission, since they bypass
// the normal customer-driven flow.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "bookings.force_complete")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const reason: string | undefined =
      typeof body.reason === "string" ? body.reason.trim() : undefined;

    const booking = await db.booking.findUnique({
      where: { id },
      select: { id: true, status: true, proId: true },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    let newStatus: BookingStatus | null = null;
    if (body.forceComplete === true) {
      newStatus = "CONFIRMED";
    } else if (typeof body.status === "string") {
      if (!ALLOWED_STATUSES.includes(body.status as BookingStatus)) {
        return NextResponse.json(
          { success: false, error: "Invalid status" },
          { status: 400 },
        );
      }
      newStatus = body.status as BookingStatus;
    }

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: "Provide either `status` or `forceComplete`." },
        { status: 400 },
      );
    }

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { success: false, error: "Please provide a reason (min 5 chars) — admin status changes are audited." },
        { status: 400 },
      );
    }

    const fromStatus = booking.status;

    // Apply status change in a single transaction. Stamp the relevant
    // *At timestamp so the timeline reflects the manual transition.
    const now = new Date();
    const stamps: Record<string, Date> = {};
    if (newStatus === "ACCEPTED") stamps.acceptedAt = now;
    if (newStatus === "EN_ROUTE") stamps.enRouteAt = now;
    if (newStatus === "ARRIVED") stamps.arrivedAt = now;
    if (newStatus === "COMPLETED") stamps.completedAt = now;
    if (newStatus === "CONFIRMED") {
      stamps.completedAt = now;
      stamps.confirmedAt = now;
    }
    if (newStatus === "CANCELLED") stamps.cancelledAt = now;

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: newStatus!, ...stamps },
      });

      // If we cancelled / completed and the pro is still BUSY on this
      // booking, free them up.
      if (
        booking.proId &&
        (newStatus === "CANCELLED" ||
          newStatus === "CONFIRMED" ||
          newStatus === "COMPLETED")
      ) {
        await tx.pro.updateMany({
          where: { id: booking.proId, currentBookingId: id },
          data: { availability: "ONLINE", currentBookingId: null },
        });
      }

      // Persist the admin note for the audit trail.
      await tx.note.create({
        data: {
          entityType: "booking",
          entityId: id,
          authorId: session!.userId,
          content: `Status: ${fromStatus} → ${newStatus}. ${reason}`,
        },
      });
    });

    await logAdminAction({
      adminId: session!.userId,
      action: body.forceComplete ? "booking.force_complete" : "booking.status_change",
      entityType: "booking",
      entityId: id,
      metadata: { fromStatus, toStatus: newStatus, reason },
    });

    return NextResponse.json({ success: true, data: { status: newStatus } });
  } catch (err) {
    console.error("admin booking PATCH error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update booking" },
      { status: 500 },
    );
  }
}
