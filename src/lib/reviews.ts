/**
 * Reviews: submission (shared by the signed-in modal and one-tap links),
 * signed review links for WhatsApp, the post-booking review request, and
 * real aggregate ratings for service pages.
 *
 * Ratings shown publicly come only from Review rows (one per confirmed
 * booking), never from Pro.avgRating, which demo data can inflate.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { awardPoints, POINTS } from "@/lib/points";

// ─── Signed links ──────────────────────────────────────────────────────────

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is required for review links");
  return s;
};
const sign = (bookingId: string) =>
  crypto.createHmac("sha256", secret()).update(`review:${bookingId}`).digest("base64url").slice(0, 22);

export function reviewToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId)}`;
}

/** Booking id if the token is genuine, else null (constant-time compare). */
export function bookingIdFromToken(token: string): string | null {
  const [id, mac] = token.split(".");
  if (!id || !mac) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(mac);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? id : null;
}

export const reviewUrl = (bookingId: string) => `${SITE_URL}/review/${reviewToken(bookingId)}`;

// ─── Submit ────────────────────────────────────────────────────────────────

export class ReviewError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_CONFIRMED" | "ALREADY" | "NO_PRO", message: string) {
    super(message);
  }
}

export async function submitReview(o: { bookingId: string; rating: number; comment?: string | null }) {
  const booking = await db.booking.findUnique({ where: { id: o.bookingId }, include: { review: true } });
  if (!booking) throw new ReviewError("NOT_FOUND", "Booking not found.");
  if (booking.status !== "CONFIRMED") throw new ReviewError("NOT_CONFIRMED", "You can review once the job is confirmed.");
  if (booking.review) throw new ReviewError("ALREADY", "Thanks, this booking has already been reviewed.");
  if (!booking.proId) throw new ReviewError("NO_PRO", "There's no pro on this booking to review.");

  const review = await db.review.create({
    data: { bookingId: booking.id, rating: o.rating, text: o.comment?.trim() || null },
  });
  const agg = await db.review.aggregate({
    where: { booking: { proId: booking.proId } },
    _avg: { rating: true },
    _count: { id: true },
  });
  await db.pro.update({
    where: { id: booking.proId },
    data: { avgRating: agg._avg.rating ?? o.rating, reviewCount: agg._count.id },
  });
  await awardPoints(booking.customerId, POINTS.LEAVE_REVIEW, "Left a review", review.id).catch(() => {});
  return { review, booking };
}

// ─── Request after the job ─────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const lagosHour = (d: Date) => (d.getUTCHours() + 1) % 24;

/** One WhatsApp per confirmed booking, 2h–7d after confirmation, 09:00–20:00 Lagos. */
export async function runReviewRequests(now = new Date(), opts: { batch?: number; ignoreHours?: boolean } = {}) {
  const hour = lagosHour(now);
  if (!opts.ignoreHours && (hour < 9 || hour >= 20)) return { sent: 0, skipped: "outside 09:00-20:00 Lagos" };

  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      reviewRequestSentAt: null,
      review: null,
      proId: { not: null },
      confirmedAt: { gte: new Date(now.getTime() - 7 * 24 * HOUR), lte: new Date(now.getTime() - 2 * HOUR) },
      customer: { phone: { not: null }, marketingOptOut: false },
    },
    orderBy: { confirmedAt: "asc" },
    take: opts.batch ?? 20,
    select: {
      id: true,
      service: { select: { name: true } },
      pro: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
    },
  });

  const { sendMessage } = await import("@/lib/whatsapp");
  let sent = 0;
  for (const b of due) {
    // Claim first so overlapping cron runs can't double-send.
    const claimed = await db.booking.updateMany({
      where: { id: b.id, reviewRequestSentAt: null },
      data: { reviewRequestSentAt: now },
    });
    if (claimed.count === 0) continue;
    const first = b.customer.name?.trim().split(/\s+/)[0];
    const msg =
      `${first ? `Hi ${first}!` : "Hi!"} How was your ${b.service.name.toLowerCase()}${b.pro?.name ? ` with ${b.pro.name}` : ""}? 💚\n\n` +
      `Tap to rate it, it takes 10 seconds: ${reviewUrl(b.id)}\n\n` +
      `Your rating helps other customers and helps ${b.pro?.name ?? "your pro"} get more bookings.`;
    try {
      await sendMessage(b.customer.phone!, msg);
      sent++;
    } catch (err) {
      console.error("[reviews] request failed", b.id, err);
    }
  }
  return { sent, considered: due.length };
}

// ─── Public aggregate per service ──────────────────────────────────────────

/** Real ratings for a service slug; null below `min` reviews (no thin stars). */
export async function serviceRating(slug: string, min = 3) {
  try {
    const agg = await db.review.aggregate({
      where: { booking: { service: { slug }, status: "CONFIRMED" } },
      _avg: { rating: true },
      _count: { id: true },
    });
    if (agg._count.id < min || !agg._avg.rating) return null;
    const recent = await db.review.findMany({
      where: { booking: { service: { slug } }, text: { not: null }, rating: { gte: 4 } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { rating: true, text: true, createdAt: true, booking: { select: { customer: { select: { name: true } }, zone: { select: { name: true } } } } },
    });
    return {
      average: Math.round(agg._avg.rating * 10) / 10,
      count: agg._count.id,
      recent: recent.map((r) => ({
        rating: r.rating,
        text: r.text!,
        // First name + initial only; never a full name or phone.
        author: (() => {
          const parts = (r.booking.customer.name ?? "").trim().split(/\s+/).filter(Boolean);
          return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ""}` : "Groomee customer";
        })(),
        area: r.booking.zone?.name ?? null,
        date: r.createdAt.toISOString().slice(0, 10),
      })),
    };
  } catch {
    return null;
  }
}
