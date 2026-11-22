import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { quoteBooking, PriceOverrideError, serialiseQuote } from "@/lib/booking-pricing";
import { conciergeInputSchema } from "@/lib/concierge";

const quoteSchema = conciergeInputSchema.pick({
  isAsap: true,
  scheduledFor: true,
  serviceIds: true,
  proId: true,
  priceOverride: true,
});

// POST /api/admin/concierge/quote: the exact breakdown the booking will carry.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "bookings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = quoteSchema.parse(await req.json());
    const [primaryServiceId, ...additionalServiceIds] = input.serviceIds;
    const q = await quoteBooking({
      primaryServiceId,
      additionalServiceIds,
      proId: input.proId ?? null,
      isAsap: input.isAsap,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      baseOverride: input.priceOverride ?? null,
    });
    return NextResponse.json({ success: true, data: serialiseQuote(q) });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    if (err instanceof PriceOverrideError)
      return NextResponse.json({ success: false, error: err.message, code: "PRICE_OUT_OF_RANGE" }, { status: 400 });
    const msg = err instanceof Error ? err.message : "Could not price this booking.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
