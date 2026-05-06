import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, "bookings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { proId } = await req.json();
    if (!proId)
      return NextResponse.json(
        { error: "proId required" },
        { status: 400 },
      );

    const [booking, pro] = await Promise.all([
      db.booking.findUnique({ where: { id } }),
      db.pro.findUnique({ where: { id: proId } }),
    ]);

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!pro)
      return NextResponse.json({ error: "Pro not found" }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { proId, status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.pro.update({
        where: { id: proId },
        data: { availability: "BUSY", currentBookingId: id },
      });
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "booking.assign",
      entityType: "booking",
      entityId: id,
      metadata: { proId, proName: pro.name, previousStatus: booking.status },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("assign pro error:", err);
    return NextResponse.json(
      { error: "Failed to assign pro" },
      { status: 500 },
    );
  }
}
