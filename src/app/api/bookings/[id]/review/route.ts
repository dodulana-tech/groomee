import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
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
    const { rating, comment } = reviewSchema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id },
      include: { review: true },
    });

    if (!booking)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.customerId !== session.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (booking.status !== "CONFIRMED")
      return NextResponse.json(
        { error: "Can only review confirmed bookings" },
        { status: 400 },
      );
    if (booking.review)
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
    if (!booking.groomerId)
      return NextResponse.json(
        { error: "No groomer to review" },
        { status: 400 },
      );

    const review = await db.review.create({
      data: { bookingId: booking.id, rating, text: comment ?? null },
    });

    // Recalculate groomer avg rating from all reviews via bookings
    const agg = await db.review.aggregate({
      where: { booking: { groomerId: booking.groomerId } },
      _avg: { rating: true },
      _count: { id: true },
    });

    await db.groomer.update({
      where: { id: booking.groomerId },
      data: {
        avgRating: agg._avg.rating ?? rating,
        reviewCount: agg._count.id,
      },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 },
      );
    console.error("review error:", err);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 },
    );
  }
}
