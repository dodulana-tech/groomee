import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ReviewError, bookingIdFromToken, submitReview } from "@/lib/reviews";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// POST /api/reviews/<signed token> — one-tap review from a WhatsApp link.
// The token is an HMAC of the booking id, so it can't be guessed or reused
// for another booking; a booking takes one review only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const bookingId = bookingIdFromToken((await params).token);
  if (!bookingId) return NextResponse.json({ success: false, error: "This review link isn't valid." }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Choose 1 to 5 stars." }, { status: 400 });
  try {
    const { review } = await submitReview({ bookingId, ...parsed.data });
    return NextResponse.json({ success: true, data: { rating: review.rating } }, { status: 201 });
  } catch (err) {
    if (err instanceof ReviewError) {
      return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: err.code === "ALREADY" ? 409 : 400 });
    }
    console.error("review link error:", err);
    return NextResponse.json({ success: false, error: "Couldn't save your review. Please try again." }, { status: 500 });
  }
}
