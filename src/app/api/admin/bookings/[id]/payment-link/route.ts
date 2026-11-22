import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBookingPaymentLink, PaymentLinkError } from "@/lib/booking-payment";
import { payMessageForBooking, waMeLink } from "@/lib/concierge";
import { sendMessage } from "@/lib/whatsapp";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/bookings/[id]/payment-link: resend the pay link for an
// unpaid booking. Re-uses the live Paystack link while it is still pending.
// Body: { send?: boolean } — send=false only returns the link + message.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "bookings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  let send = true;
  try {
    const body = await req.json();
    if (body?.send === false) send = false;
  } catch {}

  try {
    const link = await getBookingPaymentLink(id);
    const msg = await payMessageForBooking(id, link.url);
    if (!msg.phone) {
      return NextResponse.json(
        { success: false, error: "This customer has no phone number on file." },
        { status: 400 },
      );
    }
    let fallbackSent = false;
    if (send) {
      fallbackSent = !!(await sendMessage(msg.phone, msg.text)).success;
      await db.booking.update({ where: { id }, data: { paymentLinkSentAt: new Date() } });
    }
    await logAdminAction({
      adminId: session!.userId,
      action: "booking.payment_link_resend",
      entityType: "booking",
      entityId: id,
      metadata: { reused: link.reused, sent: send, fallbackSent },
    });
    return NextResponse.json({
      success: true,
      data: {
        payUrl: link.url,
        reused: link.reused,
        message: msg.text,
        whatsappUrl: waMeLink(msg.phone, msg.text),
        fallbackSent,
      },
    });
  } catch (err) {
    if (err instanceof PaymentLinkError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    console.error("[payment-link] resend failed", err);
    return NextResponse.json(
      { success: false, error: "Paystack didn't return a link. Try again in a minute." },
      { status: 502 },
    );
  }
}
