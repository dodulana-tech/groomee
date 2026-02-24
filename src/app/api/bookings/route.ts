import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateSurcharge, calculateEarnings } from "@/lib/surcharge";
import {
  generateBookingReference,
  generatePaymentReference,
  initializeTransaction,
} from "@/lib/paystack";
import { tryNextGroomer } from "@/lib/dispatch";
import { z } from "zod";

const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  address: z.string().min(5),
  addressExtra: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isAsap: z.boolean(),
  scheduledFor: z.string().datetime().optional(),
  customerNotes: z.string().max(500).optional(),
  zoneId: z.string().optional(),
});

// GET /api/bookings — list customer's bookings
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
        groomer: true,
        zone: true,
        review: true,
        payment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: bookings });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

// POST /api/bookings — create booking
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

    const user = await db.user.findUnique({ where: { id: session.userId } });
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

    // Get groomer commission (default 20%)
    const commissionRate = 0.2;
    const { totalAmount, platformFee, groomerEarning } = calculateEarnings({
      baseAmount: service.basePrice,
      surchargeAmount: surcharge.amount,
      surchargeType: surcharge.type,
      commissionRate,
    });

    const reference = generateBookingReference();
    const paymentRef = generatePaymentReference(reference);

    // Create booking
    const booking = await db.booking.create({
      data: {
        reference,
        customerId: session.userId,
        serviceId: service.id,
        zoneId: input.zoneId ?? null,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        isAsap: input.isAsap,
        scheduledFor,
        customerNotes: input.customerNotes,
        baseAmount: service.basePrice,
        surchargeType: surcharge.type,
        surchargeAmount: surcharge.amount,
        totalAmount,
        groomerEarning,
        status: "PENDING_PAYMENT",
      },
    });

    // Initialize Paystack payment
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paystack = await initializeTransaction({
      email: user.email ?? `${user.phone.replace(/\+/g, "")}@groomee.ng`,
      phone: user.phone,
      amount: totalAmount,
      reference: paymentRef,
      callbackUrl: `${appUrl}/api/payments/verify?bookingId=${booking.id}`,
      metadata: { bookingId: booking.id, reference, userId: session.userId },
    });

    // Create payment record
    await db.payment.create({
      data: {
        bookingId: booking.id,
        reference: paymentRef,
        paystackRef: paymentRef,
        amount: totalAmount,
        status: "PENDING",
      },
    });

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
