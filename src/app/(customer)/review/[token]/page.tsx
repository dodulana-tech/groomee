import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bookingIdFromToken } from "@/lib/reviews";
import ReviewForm from "./ReviewForm";

export const metadata: Metadata = { title: "Rate your Groomee pro", robots: { index: false, follow: false } };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bookingId = bookingIdFromToken(token);
  if (!bookingId) notFound();
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      customerId: true,
      service: { select: { name: true } },
      pro: { select: { name: true } },
      review: { select: { rating: true } },
    },
  });
  if (!booking) notFound();
  const code = booking.customerId.slice(-8).toUpperCase();
  return (
    <div className="min-h-[80vh] bg-gray-950 px-4 py-12">
      <div className="container max-w-md">
        <p className="text-xs font-bold uppercase tracking-widest text-[#25D366]">Groomee</p>
        <h1 className="mt-3 font-display text-3xl font-black text-white">
          How was your {booking.service.name.toLowerCase()}
          {booking.pro?.name ? ` with ${booking.pro.name}` : ""}?
        </h1>
        <ReviewForm
          token={token}
          alreadyRated={booking.review?.rating ?? null}
          canReview={booking.status === "CONFIRMED"}
          proName={booking.pro?.name ?? null}
          googleReviewUrl={process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || null}
          referralCode={code}
        />
      </div>
    </div>
  );
}
