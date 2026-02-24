import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const disputeSchema = z.object({
  reason: z.string().min(3),
  description: z.string().min(10).max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { reason, description } = disputeSchema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id },
      include: { dispute: true },
    });

    if (!booking)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.customerId !== session.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (booking.dispute)
      return NextResponse.json(
        { error: "A dispute already exists for this booking" },
        { status: 400 },
      );

    if (!["COMPLETED", "CONFIRMED", "CANCELLED"].includes(booking.status)) {
      return NextResponse.json(
        { error: "This booking cannot be disputed at this stage" },
        { status: 400 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          bookingId: booking.id,
          reason,
          notes: description ?? null,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "DISPUTED" },
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("dispute error:", err);
    return NextResponse.json(
      { error: "Failed to submit dispute" },
      { status: 500 },
    );
  }
}
