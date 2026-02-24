import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { groomerId } = await req.json();
    if (!groomerId)
      return NextResponse.json(
        { error: "groomerId required" },
        { status: 400 },
      );

    const [booking, groomer] = await Promise.all([
      db.booking.findUnique({ where: { id } }),
      db.groomer.findUnique({ where: { id: groomerId } }),
    ]);

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!groomer)
      return NextResponse.json({ error: "Groomer not found" }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { groomerId, status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.groomer.update({
        where: { id: groomerId },
        data: { availability: "BUSY", currentBookingId: id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("assign groomer error:", err);
    return NextResponse.json(
      { error: "Failed to assign groomer" },
      { status: 500 },
    );
  }
}
