import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateSurcharge, calculateEarnings } from "@/lib/surcharge";
import {
  generateBookingReference,
  generatePaymentReference,
  initializeTransaction,
  paystackEmailFor,
} from "@/lib/paystack";
import { tryNextPro } from "@/lib/dispatch";
import { findConflict, inWorkingHours } from "@/lib/scheduling";
import { z } from "zod";

const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  // When set, the customer is booking a specific pro from that pro's profile.
  // Triggers scheduler conflict + working-hours checks for scheduled bookings.
  proId: z.string().optional(),
  address: z.string().min(5),
  addressExtra: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isAsap: z.boolean(),
  scheduledFor: z.string().datetime().optional(),
  customerNotes: z.string().max(500).optional(),
  zoneId: z.string().optional(),
  redeemPoints: z.boolean().optional(),
  giftCode: z.string().optional(),
});

// GET /api/bookings - list customer's bookings
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );

    const bookings = await db.booking.findMany({
      where: { customerId: session.userId },
      include: {
        service: true,
        pro: true,
        zone: true,
        review: true,
        payment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: bookings });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings." },
      { status: 500 },
    );
  }
}

// POST /api/bookings - create booking
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    const body = await req.json();
    const input = createBookingSchema.parse(body);

    const service = await db.service.findUnique({
      where: { id: input.serviceId, isActive: true },
    });
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found." },
        { status: 404 },
      );
    }

    // Check minimum lead time
    const settings = await db.setting.findFirst({
      where: { key: "MIN_BOOKING_LEAD_MINUTES" },
    });
    const minLeadMins = parseInt(settings?.value ?? "60");
    if (!input.isAsap && input.scheduledFor) {
      const minsUntil =
        (new Date(input.scheduledFor).getTime() - Date.now()) / 60_000;
      if (minsUntil < minLeadMins) {
        return NextResponse.json(
          {
            success: false,
            error: `Minimum booking lead time is ${minLeadMins} minutes.`,
          },
          { status: 400 },
        );
      }
    }

    // ─── Scheduler enforcement (pro pre-selected + scheduled time) ───
    // When the customer is booking a specific pro for a future time, we
    // refuse the booking if it would land outside the pro's working hours
    // or collide with another booking (including travel buffers).
    const proStart =
      !input.isAsap && input.scheduledFor && input.proId
        ? new Date(input.scheduledFor)
        : null;
    if (proStart && input.proId) {
      const proEnd = new Date(
        proStart.getTime() + service.durationMins * 60_000,
      );
      const withinHours = await inWorkingHours({
        proId: input.proId,
        start: proStart,
        end: proEnd,
      });
      if (!withinHours) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected time is outside the pro's working hours.",
          },
          { status: 409 },
        );
      }
      const hit = await findConflict({
        proId: input.proId,
        start: proStart,
        end: proEnd,
        zoneId: input.zoneId ?? null,
      });
      if (hit.conflict) {
        return NextResponse.json(
          { success: false, error: hit.reason, code: "SCHEDULE_CONFLICT" },
          { status: 409 },
        );
      }
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, phone: true, email: true, points: true },
    });
    if (!user)
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );

    // Calculate pricing
    const scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor)
      : null;
    const surcharge = await calculateSurcharge(
      input.isAsap ? null : scheduledFor,
      service.basePrice,
    );

    // Get pro commission (default 20%)
    const commissionRate = 0.2;
    const { totalAmount: rawTotal, proEarning } = calculateEarnings({
      baseAmount: service.basePrice,
      surchargeAmount: surcharge.amount,
      surchargeType: surcharge.type,
      commissionRate,
    });

    // Points redemption: 100 pts → ₦500 discount
    const POINTS_REQUIRED = 100;
    const POINTS_DISCOUNT_VALUE = 500;
    let pointsDiscount = 0;
    const canRedeem =
      input.redeemPoints === true && (user.points ?? 0) >= POINTS_REQUIRED;
    if (canRedeem) {
      pointsDiscount = Math.min(POINTS_DISCOUNT_VALUE, rawTotal);
    }

    // Gift card redemption
    let giftDiscount = 0;
    let appliedGiftCard: { id: string; amount: number } | null = null;
    if (input.giftCode) {
      const giftCard = await db.giftCard.findFirst({
        where: {
          code: input.giftCode.trim().toUpperCase(),
          isRedeemed: false,
          expiresAt: { gt: new Date() },
        },
      });
      if (giftCard) {
        giftDiscount = Math.min(giftCard.amount, rawTotal - pointsDiscount);
        appliedGiftCard = { id: giftCard.id, amount: giftCard.amount };
      }
    }

    const totalAmount = Math.max(0, rawTotal - pointsDiscount - giftDiscount);

    const reference = generateBookingReference();
    const paymentRef = generatePaymentReference(reference);

    // Atomic: booking + gift card + points + payment in single transaction
    const booking = await db.$transaction(async (tx) => {
      const bk = await tx.booking.create({
        data: {
          reference,
          customerId: session.userId,
          serviceId: service.id,
          proId: input.proId ?? null,
          zoneId: input.zoneId ?? null,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          isAsap: input.isAsap,
          scheduledFor,
          durationMins: service.durationMins,
          customerNotes: input.customerNotes,
          baseAmount: service.basePrice,
          surchargeType: surcharge.type,
          surchargeAmount: surcharge.amount,
          totalAmount,
          proEarning,
          status: "PENDING_PAYMENT",
        },
      });

      // Mark gift card as redeemed (conditional to prevent double-redeem race)
      if (appliedGiftCard) {
        const redeemed = await tx.giftCard.updateMany({
          where: { id: appliedGiftCard.id, isRedeemed: false },
          data: { isRedeemed: true, redeemedAt: new Date(), redeemedBy: session.userId, bookingId: bk.id },
        });
        if (redeemed.count === 0) throw new Error("Gift card already redeemed");
      }

      // Deduct points (conditional to prevent negative balance race)
      if (canRedeem) {
        await tx.user.update({
          where: { id: session.userId },
          data: { points: { decrement: POINTS_REQUIRED } },
        });
        await tx.pointsLedger.create({
          data: {
            userId: session.userId,
            amount: -POINTS_REQUIRED,
            reason: "Redeemed for booking discount",
            referenceId: bk.id,
          },
        });
      }

      // Create payment record
      await tx.payment.create({
        data: {
          bookingId: bk.id,
          reference: paymentRef,
          paystackRef: paymentRef,
          amount: totalAmount,
          status: "PENDING",
        },
      });

      return bk;
    });

    // Initialize Paystack payment (network call — outside transaction)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paystack = await initializeTransaction({
      email: paystackEmailFor(user),
      phone: user.phone,
      amount: totalAmount,
      reference: paymentRef,
      callbackUrl: `${appUrl}/api/payments/verify?bookingId=${booking.id}`,
      metadata: { bookingId: booking.id, reference, userId: session.userId },
    });

    // Send booking email (fire-and-forget)
    import("@/lib/email-notify").then(({ emailBookingCreated }) =>
      emailBookingCreated({
        id: booking.id,
        reference,
        totalAmount,
        isAsap: input.isAsap,
        customerId: session.userId,
        service: { name: service.name },
        authorizationUrl: paystack.authorization_url,
      }),
    ).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        data: {
          bookingId: booking.id,
          reference,
          authorizationUrl: paystack.authorization_url,
          accessCode: paystack.access_code,
          totalAmount,
          surcharge,
          ...(pointsDiscount > 0 && { pointsDiscount }),
          ...(giftDiscount > 0 && { giftDiscount }),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("create booking error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create booking." },
      { status: 500 },
    );
  }
}
