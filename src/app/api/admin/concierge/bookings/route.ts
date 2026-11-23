import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateBookingReference, generatePaymentReference } from "@/lib/paystack";
import { quoteBooking, PriceOverrideError, serialiseQuote } from "@/lib/booking-pricing";
import { getBookingPaymentLink, PaymentLinkError } from "@/lib/booking-payment";
import { CityNotLiveError, requireConciergeCityForZone } from "@/lib/cities";
import { findConflict, inWorkingHours } from "@/lib/scheduling";
import { checkContraindications, highestLevel } from "@/lib/health";
import { logAdminAction } from "@/lib/admin-audit";
import { sendMessage } from "@/lib/whatsapp";
import {
  conciergeInputSchema,
  findOrCreateCustomerByPhone,
  normaliseNigerianPhone,
  payMessageForBooking,
  waMeLink,
} from "@/lib/concierge";

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status });

// POST /api/admin/concierge/bookings: ops creates a booking from a WhatsApp
// chat and gets back a Paystack pay link to send the customer.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "bookings.manage")) return fail("Forbidden", 403);

  let input;
  try {
    input = conciergeInputSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return fail(err.errors[0].message, 400);
    return fail("Invalid request.", 400);
  }

  try {
    const phone = normaliseNigerianPhone(input.phone);
    if (!phone) return fail("That doesn't look like a Nigerian mobile number (e.g. 0803 123 4567).", 400);

    // City gate: LIVE cities plus WhatsApp-concierge cities (e.g. Abuja).
    let city;
    try {
      city = await requireConciergeCityForZone(input.zoneId);
    } catch (err) {
      if (err instanceof CityNotLiveError) return fail(err.message, 409, { code: "CITY_NOT_BOOKABLE" });
      throw err;
    }

    const scheduledFor = !input.isAsap && input.scheduledFor ? new Date(input.scheduledFor) : null;
    if (!input.isAsap && !scheduledFor) return fail("Pick a date and time, or choose ASAP.", 400);

    // Same minimum lead time as the customer flow.
    if (scheduledFor) {
      const setting = await db.setting.findFirst({ where: { key: "MIN_BOOKING_LEAD_MINUTES" } });
      const minLeadMins = parseInt(setting?.value ?? "60");
      if ((scheduledFor.getTime() - Date.now()) / 60_000 < minLeadMins) {
        return fail(`Pick a time at least ${minLeadMins} minutes from now, or choose ASAP.`, 400);
      }
    }

    const hasOverride = input.priceOverride !== undefined && input.priceOverride !== null;
    const [primaryServiceId, ...additionalServiceIds] = input.serviceIds;
    let quote;
    try {
      quote = await quoteBooking({
        primaryServiceId,
        additionalServiceIds,
        proId: input.proId ?? null,
        isAsap: input.isAsap,
        scheduledFor,
        baseOverride: hasOverride ? input.priceOverride : null,
      });
    } catch (err) {
      if (err instanceof PriceOverrideError) return fail(err.message, 400, { code: "PRICE_OUT_OF_RANGE" });
      return fail(err instanceof Error ? err.message : "Service unavailable.", 400);
    }
    if (quote.overridden && (input.overrideReason?.trim().length ?? 0) < 3) {
      return fail("Add a short reason for the price change.", 400, { code: "OVERRIDE_REASON_REQUIRED" });
    }

    // Pre-assigned pro: must be active; scheduled slots go through the same
    // scheduler checks as the customer flow unless ops forces it.
    if (input.proId) {
      const pro = await db.pro.findUnique({ where: { id: input.proId }, select: { status: true } });
      if (!pro || pro.status !== "ACTIVE") return fail("That pro isn't active.", 400);
      if (scheduledFor && !input.force) {
        const end = new Date(scheduledFor.getTime() + quote.resolved.totalDurationMins * 60_000);
        if (!(await inWorkingHours({ proId: input.proId, start: scheduledFor, end }))) {
          return fail("That time is outside this pro's working hours.", 409, { code: "OUT_OF_HOURS" });
        }
        const hit = await findConflict({ proId: input.proId, start: scheduledFor, end, zoneId: input.zoneId });
        if (hit.conflict) return fail(hit.reason ?? "This pro is already booked then.", 409, { code: "SCHEDULE_CONFLICT" });
      }
    }

    const { user: customer, created: customerCreated } = await findOrCreateCustomerByPhone(phone, input.name);

    // Same health gate as the customer flow (only bites for returning
    // customers who have filled in a health profile).
    const allServiceIds = [quote.resolved.primary.id, ...quote.resolved.additional.map((s) => s.id)];
    const healthHits = await checkContraindications(customer.id, allServiceIds);
    const healthLevel = highestLevel(healthHits);
    if (healthLevel === "BLOCK") {
      const labels = Array.from(
        new Set(healthHits.filter((h) => h.level === "BLOCK").map((h) => h.conditionLabel)),
      ).join(", ");
      return fail(
        `This customer's health profile (${labels}) rules out one of these services. Pick a different service.`,
        422,
        { code: "HEALTH_BLOCK" },
      );
    }

    const reference = generateBookingReference();
    const paymentRef = generatePaymentReference(reference);
    const { primary, additional } = quote.resolved;

    const booking = await db.$transaction(async (tx) => {
      const bk = await tx.booking.create({
        data: {
          reference,
          customerId: customer.id,
          serviceId: primary.id,
          proId: input.proId ?? null,
          zoneId: input.zoneId,
          address: input.address,
          isAsap: input.isAsap,
          scheduledFor,
          durationMins: quote.resolved.totalDurationMins,
          customerNotes: input.notes?.trim() || null,
          baseAmount: quote.baseAmount,
          surchargeType: quote.surcharge.type,
          surchargeAmount: quote.surcharge.amount,
          totalAmount: quote.totalAmount,
          proEarning: quote.proEarning,
          status: "PENDING_PAYMENT",
          source: "WHATSAPP_CONCIERGE",
          createdByAdminId: session!.userId,
          listBaseAmount: quote.overridden ? quote.listBaseAmount : null,
          priceOverrideReason: quote.overridden ? input.overrideReason!.trim() : null,
        },
      });
      if (additional.length > 0) {
        await tx.bookingItem.createMany({
          data: additional.map((s, idx) => ({
            bookingId: bk.id,
            serviceId: s.id,
            customPrice: s.customPrice,
            durationMins: s.durationMins,
            sortOrder: idx + 1,
          })),
        });
      }
      await tx.payment.create({
        data: {
          bookingId: bk.id,
          reference: paymentRef,
          paystackRef: paymentRef,
          amount: quote.totalAmount,
          status: "PENDING",
        },
      });
      return bk;
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "booking.concierge_create",
      entityType: "booking",
      entityId: booking.id,
      metadata: {
        reference,
        city: city.slug,
        customerId: customer.id,
        customerCreated,
        totalAmount: quote.totalAmount,
        ...(quote.overridden && {
          listBaseAmount: quote.listBaseAmount,
          baseAmount: quote.baseAmount,
          overrideReason: input.overrideReason,
        }),
        proId: input.proId ?? null,
        forced: !!input.force,
      },
    });

    // Pay link. If Paystack is down the booking still exists; ops can retry
    // with "Resend payment link" from the bookings list.
    let link;
    try {
      link = await getBookingPaymentLink(booking.id, { paymentRef });
    } catch (err) {
      console.error("[concierge] payment link failed", err);
      return fail(
        err instanceof PaymentLinkError ? err.message : "Booking saved, but Paystack didn't return a pay link. Try 'Resend payment link' in a minute.",
        502,
        { code: "PAYMENT_LINK_FAILED", bookingId: booking.id, reference },
      );
    }

    const msg = await payMessageForBooking(booking.id, link.url);
    // Fallback delivery through the transactional sender, in case the ops
    // person's own WhatsApp send doesn't happen.
    const sent = await sendMessage(phone, msg.text);
    await db.booking.update({ where: { id: booking.id }, data: { paymentLinkSentAt: new Date() } });

    return NextResponse.json(
      {
        success: true,
        data: {
          bookingId: booking.id,
          reference,
          customer: { id: customer.id, name: customer.name, phone, created: customerCreated },
          city: { name: city.name, slug: city.slug, status: city.status },
          payUrl: link.url,
          message: msg.text,
          whatsappUrl: waMeLink(phone, msg.text),
          fallbackSent: !!sent.success,
          quote: serialiseQuote(quote),
          healthLevel,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[concierge] create failed", err);
    return fail("Couldn't create the booking. Please try again.", 500);
  }
}
