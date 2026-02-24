import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initializeTransaction,
  generatePaymentReference,
} from "@/lib/paystack";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const booking = await db.booking.findUnique({
      where: { id },
      include: { service: true, payment: true },
    });

    if (!booking)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.customerId !== session.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (booking.status !== "PENDING_PAYMENT")
      return NextResponse.json(
        { error: "Booking is not awaiting payment" },
        { status: 400 },
      );

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paymentRef = generatePaymentReference(booking.reference);

    const paystack = await initializeTransaction({
      email: user.email ?? `${user.phone.replace(/\+/g, "")}@groomee.ng`,
      phone: user.phone,
      amount: booking.totalAmount,
      reference: paymentRef,
      callbackUrl: `${appUrl}/api/payments/verify?bookingId=${booking.id}`,
      metadata: {
        bookingId: booking.id,
        reference: booking.reference,
        userId: session.userId,
      },
    });

    // Update or create payment record with new reference
    await db.payment.upsert({
      where: { bookingId: booking.id },
      update: { paystackRef: paymentRef, status: "PENDING" },
      create: {
        bookingId: booking.id,
        reference: paymentRef,
        paystackRef: paymentRef,
        amount: booking.totalAmount,
        status: "PENDING",
      },
    });

    return NextResponse.json({ url: paystack.authorization_url });
  } catch (err) {
    console.error("payment-url error:", err);
    return NextResponse.json(
      { error: "Failed to generate payment link" },
      { status: 500 },
    );
  }
}
