/**
 * Booking payment lifecycle, shared by every path that touches it:
 *
 *  - getBookingPaymentLink: Paystack checkout link for a PENDING_PAYMENT
 *    booking. Used by POST /api/bookings, GET /api/bookings/[id]/payment-url
 *    (customer "Pay now"), and the ops concierge create / resend routes.
 *  - confirmBookingPayment: moves a paid booking forward (payment AUTHORISED,
 *    booking DISPATCHING, offer to pre-assigned pro or dispatch, notify).
 *    Called from both the Paystack return (/api/webhooks/paystack/return, an
 *    alias of /api/payments/verify) and the
 *    charge.success webhook, so a booking moves forward even when the
 *    customer paid from a browser with no Groomee session (the normal case
 *    for a link sent over WhatsApp).
 */
import { db } from "@/lib/db";
import {
  generatePaymentReference,
  initializeTransaction,
  paystackEmailFor,
} from "@/lib/paystack";
import { SITE_URL } from "@/lib/site";
import { formatNaira } from "@/lib/utils";

/** ASAP bookings older than this can't be paid for any more. */
const ASAP_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export class PaymentLinkError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "NOT_PENDING" | "EXPIRED",
  ) {
    super(message);
    this.name = "PaymentLinkError";
  }
}

/**
 * A PENDING_PAYMENT booking stays open until it is paid or cancelled (that
 * is the long-standing behaviour). What we refuse is issuing a link to pay
 * for a slot that has already gone: a scheduled time in the past, or an
 * ASAP request more than a day old.
 */
export function isPaymentWindowClosed(
  b: { isAsap: boolean; scheduledFor: Date | null; createdAt: Date },
  now = new Date(),
): boolean {
  if (!b.isAsap && b.scheduledFor) return b.scheduledFor.getTime() < now.getTime();
  return now.getTime() - b.createdAt.getTime() > ASAP_PAYMENT_WINDOW_MS;
}

export function paymentCallbackUrl(bookingId: string): string {
  return `${SITE_URL}/api/webhooks/paystack/return?bookingId=${bookingId}`;
}

/**
 * Returns a Paystack checkout URL for the booking.
 *
 * - While the Payment row is PENDING and we already hold its checkout URL,
 *   the same URL is returned, so every link the customer has received points
 *   at the one reference we are waiting on.
 * - Otherwise (no URL yet, or the last attempt FAILED) a fresh reference is
 *   initialised and the Payment row updated to it.
 * - `paymentRef` lets the create path initialise the reference it already
 *   wrote inside its transaction.
 */
export async function getBookingPaymentLink(
  bookingId: string,
  opts: { paymentRef?: string; forceNew?: boolean } = {},
): Promise<{ url: string; reference: string; accessCode?: string; reused: boolean }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      customer: { select: { id: true, email: true, phone: true } },
    },
  });
  if (!booking) throw new PaymentLinkError("Booking not found.", "NOT_FOUND");
  if (booking.status !== "PENDING_PAYMENT")
    throw new PaymentLinkError("Booking is not awaiting payment.", "NOT_PENDING");
  if (isPaymentWindowClosed(booking))
    throw new PaymentLinkError(
      "This booking's time has passed. Cancel it and create a new one.",
      "EXPIRED",
    );

  const p = booking.payment;
  if (
    !opts.forceNew &&
    !opts.paymentRef &&
    p?.status === "PENDING" &&
    p.authorizationUrl &&
    p.paystackRef &&
    p.amount === booking.totalAmount
  ) {
    return { url: p.authorizationUrl, reference: p.paystackRef, reused: true };
  }

  const paymentRef = opts.paymentRef ?? generatePaymentReference(booking.reference);
  const paystack = await initializeTransaction({
    email: paystackEmailFor(booking.customer),
    phone: booking.customer.phone,
    amount: booking.totalAmount,
    reference: paymentRef,
    callbackUrl: paymentCallbackUrl(booking.id),
    metadata: {
      bookingId: booking.id,
      reference: booking.reference,
      userId: booking.customerId,
      source: booking.source,
    },
  });

  await db.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      paystackRef: paymentRef,
      authorizationUrl: paystack.authorization_url,
      amount: booking.totalAmount,
      status: "PENDING",
    },
    create: {
      bookingId: booking.id,
      reference: paymentRef,
      paystackRef: paymentRef,
      authorizationUrl: paystack.authorization_url,
      amount: booking.totalAmount,
      status: "PENDING",
    },
  });

  return {
    url: paystack.authorization_url,
    reference: paymentRef,
    accessCode: paystack.access_code,
    reused: false,
  };
}

export type ConfirmResult =
  | { ok: true; bookingId: string; alreadyProcessed: boolean }
  | { ok: false; reason: "NOT_FOUND" | "AMOUNT_MISMATCH"; bookingId?: string };

/**
 * Idempotent: safe to call from the callback and the webhook for the same
 * charge — only the caller that flips PENDING → AUTHORISED does the work.
 *
 * `bookingIdHint` (from Paystack metadata) rescues a charge made on an older
 * reference for the same booking, as long as the booking is still waiting on
 * payment and the amount matches.
 */
export async function confirmBookingPayment(opts: {
  reference: string;
  amountKobo: number;
  bookingIdHint?: string | null;
}): Promise<ConfirmResult> {
  let payment = await db.payment.findFirst({ where: { paystackRef: opts.reference } });

  if (!payment && opts.bookingIdHint) {
    const byBooking = await db.payment.findUnique({
      where: { bookingId: opts.bookingIdHint },
      include: { booking: { select: { status: true } } },
    });
    if (
      byBooking &&
      byBooking.status !== "AUTHORISED" &&
      byBooking.status !== "CAPTURED" &&
      byBooking.booking.status === "PENDING_PAYMENT"
    ) {
      payment = await db.payment.update({
        where: { id: byBooking.id },
        data: { paystackRef: opts.reference, status: "PENDING" },
      });
    }
  }
  if (!payment) return { ok: false, reason: "NOT_FOUND" };

  const expectedKobo = Math.round(payment.amount * 100);
  if (opts.amountKobo !== expectedKobo) {
    console.error(
      `[booking-payment] amount mismatch: expected ${expectedKobo} kobo, got ${opts.amountKobo}, ref ${opts.reference}`,
    );
    return { ok: false, reason: "AMOUNT_MISMATCH", bookingId: payment.bookingId };
  }

  const flipped = await db.payment.updateMany({
    where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "AUTHORISED", authorisedAt: new Date() },
  });
  if (flipped.count === 0) {
    return { ok: true, bookingId: payment.bookingId, alreadyProcessed: true };
  }

  // Only a booking still waiting on payment, whose slot hasn't passed, moves
  // forward. Anything else was paid on an old link: keep the money visible,
  // dispatch nobody to a dead slot, and tell a person (team + customer)
  // instead of failing silently.
  const current = await db.booking.findUnique({
    where: { id: payment.bookingId },
    select: { status: true, isAsap: true, scheduledFor: true, createdAt: true, reference: true, totalAmount: true, customer: { select: { name: true, phone: true } } },
  });
  const late = current && current.status === "PENDING_PAYMENT" && isPaymentWindowClosed(current);
  const moved = late
    ? { count: 0 }
    : await db.booking.updateMany({
        where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
        data: { status: "DISPATCHING" },
      });
  if (moved.count === 0) {
    const why = late ? "its time slot had already passed" : `the booking is ${current?.status.toLowerCase().replace("_", " ") ?? "missing"}`;
    console.warn(`[booking-payment] booking ${payment.bookingId} paid but ${why}`);
    if (current) {
      const { alertOps } = await import("@/lib/ops-alert");
      await alertOps(
        `Payment needs a person: ${current.reference}`,
        `${current.customer.name ?? "A customer"} (${current.customer.phone ?? "no phone"}) paid ₦${current.totalAmount.toLocaleString()}, but ${why}, so no pro was sent. Call them to book a new time, or refund in Paystack.`,
        `${SITE_URL}/admin/bookings/${payment.bookingId}`,
      );
      if (current.customer.phone) {
        const { sendMessage } = await import("@/lib/whatsapp");
        const reason = late ? "That time slot has passed" : "That booking had been cancelled";
        await sendMessage(
          current.customer.phone,
          `We've received your payment for booking ${current.reference}. 💚\n\n${reason}, so our team will contact you shortly to book a new time or refund you.`,
        ).catch((err: unknown) => console.error("[booking-payment] customer notice failed", err));
      }
    }
    return { ok: true, bookingId: payment.bookingId, alreadyProcessed: false };
  }

  const booking = await db.booking.findUnique({
    where: { id: payment.bookingId },
    include: {
      service: { select: { name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      zone: { select: { name: true } },
    },
  });
  if (!booking) return { ok: true, bookingId: payment.bookingId, alreadyProcessed: false };

  // Pre-assigned pro (picked by the customer on a profile, or by ops on a
  // concierge booking) gets the offer first; if they decline or time out the
  // normal dispatch loop takes over, since the attempt is in DispatchLog.
  const { offerJobToPro, tryNextPro } = await import("@/lib/dispatch");
  const dispatch = booking.proId
    ? offerJobToPro(booking.id, booking.proId).catch(async (err) => {
        console.error("[booking-payment] pre-assigned offer failed, dispatching", err);
        await tryNextPro(booking.id);
      })
    : tryNextPro(booking.id);
  dispatch.catch((err) => console.error("[booking-payment] dispatch failed", err));

  import("@/lib/email-notify")
    .then(({ emailPaymentConfirmed }) =>
      emailPaymentConfirmed({
        id: booking.id,
        reference: booking.reference,
        totalAmount: payment!.amount,
        customerId: booking.customerId,
        service: { name: booking.service?.name ?? "Beauty service" },
      }),
    )
    .catch(() => {});

  // Concierge customers usually have no email on file; confirm on WhatsApp
  // in the same channel they booked through.
  if (booking.source === "WHATSAPP_CONCIERGE" && booking.customer.phone) {
    const first = booking.customer.name?.trim().split(/\s+/)[0];
    const msg =
      `${first ? `Thanks ${first}! ` : "Thanks! "}We've received your payment of ${formatNaira(payment.amount)} for ${booking.service.name} (ref ${booking.reference}).\n\n` +
      `We're confirming your beauty pro now and will message you their details shortly.\n\n` +
      `Track your booking: ${SITE_URL}/booking/${booking.id}`;
    import("@/lib/whatsapp")
      .then(({ sendMessage }) => sendMessage(booking.customer.phone!, msg))
      .catch(() => {});
  }

  return { ok: true, bookingId: booking.id, alreadyProcessed: false };
}
