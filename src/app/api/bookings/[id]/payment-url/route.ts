import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBookingPaymentLink, PaymentLinkError } from "@/lib/booking-payment";

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
      select: { customerId: true },
    });
    if (!booking)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.customerId !== session.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const link = await getBookingPaymentLink(id);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    if (err instanceof PaymentLinkError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    console.error("payment-url error:", err);
    return NextResponse.json(
      { error: "Failed to generate payment link" },
      { status: 500 },
    );
  }
}
