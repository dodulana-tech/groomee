/**
 * Single source of truth for what a booking costs. Used by the customer
 * create flow (POST /api/bookings) and the ops concierge flow
 * (/admin/bookings/new) so both charge exactly the same amount.
 *
 *   service price  = sum of line items (pro customPrice, else catalogue basePrice)
 *   urgency fee    = calculateSurcharge (surge / late-night / early-morning / emergency)
 *   total          = service price + urgency fee      (what the customer pays)
 *   platform fee   = commission on service price + 30% of urgency fee (Groomee's take)
 *   pro earning    = total − platform fee
 *
 * Points / gift-card discounts are customer-self-serve only and are applied
 * on top of this by the customer route.
 */
import { calculateEarnings, calculateSurcharge } from "@/lib/surcharge";
import { resolveBookingServices, type ResolvedItems } from "@/lib/booking-items";
import type { SurchargeResult } from "@/types";

/** Commission the customer flow has always charged. */
export const BOOKING_COMMISSION_RATE = 0.2;

export class PriceOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceOverrideError";
  }
}

export interface BookingQuote {
  resolved: ResolvedItems;
  /** Service price before any override (catalogue / pro price). */
  listBaseAmount: number;
  /** Service price actually charged (== listBaseAmount unless overridden). */
  baseAmount: number;
  overridden: boolean;
  /** Allowed override band: sum of the services' catalogue min / max. */
  priceRange: { min: number; max: number };
  surcharge: SurchargeResult;
  totalAmount: number;
  platformFee: number;
  proEarning: number;
  commissionRate: number;
}

export async function quoteBooking(opts: {
  primaryServiceId: string;
  additionalServiceIds?: string[];
  proId?: string | null;
  isAsap: boolean;
  scheduledFor?: Date | null;
  /** Admin-only: agreed service price, must sit within priceRange. */
  baseOverride?: number | null;
}): Promise<BookingQuote> {
  const resolved = await resolveBookingServices({
    primaryServiceId: opts.primaryServiceId,
    additionalServiceIds: opts.additionalServiceIds,
    proId: opts.proId ?? null,
  });
  const all = [resolved.primary, ...resolved.additional];
  const priceRange = {
    min: all.reduce((acc, s) => acc + s.minPrice, 0),
    max: all.reduce((acc, s) => acc + s.maxPrice, 0),
  };

  const listBaseAmount = resolved.totalBasePrice;
  let baseAmount = listBaseAmount;
  const hasOverride =
    opts.baseOverride !== undefined &&
    opts.baseOverride !== null &&
    opts.baseOverride !== listBaseAmount;
  if (hasOverride) {
    const v = opts.baseOverride as number;
    if (!Number.isFinite(v) || v < priceRange.min || v > priceRange.max) {
      throw new PriceOverrideError(
        `Price must be between ₦${priceRange.min.toLocaleString()} and ₦${priceRange.max.toLocaleString()}.`,
      );
    }
    baseAmount = v;
  }

  const surcharge = await calculateSurcharge(
    opts.isAsap ? null : (opts.scheduledFor ?? null),
    baseAmount,
  );
  const { totalAmount, platformFee, proEarning } = calculateEarnings({
    baseAmount,
    surchargeAmount: surcharge.amount,
    surchargeType: surcharge.type,
    commissionRate: BOOKING_COMMISSION_RATE,
  });

  return {
    resolved,
    listBaseAmount,
    baseAmount,
    overridden: hasOverride,
    priceRange,
    surcharge,
    totalAmount,
    platformFee,
    proEarning,
    commissionRate: BOOKING_COMMISSION_RATE,
  };
}

/** JSON-friendly breakdown for the admin UI. */
export function serialiseQuote(q: BookingQuote) {
  const all = [q.resolved.primary, ...q.resolved.additional];
  return {
    lines: all.map((s) => ({
      serviceId: s.id,
      name: s.name,
      price: s.customPrice ?? s.basePrice,
      proPrice: s.customPrice !== null,
      durationMins: s.durationMins,
    })),
    durationMins: q.resolved.totalDurationMins,
    listBaseAmount: q.listBaseAmount,
    baseAmount: q.baseAmount,
    overridden: q.overridden,
    priceRange: q.priceRange,
    surcharge: q.surcharge,
    totalAmount: q.totalAmount,
    platformFee: q.platformFee,
    proEarning: q.proEarning,
    commissionRate: q.commissionRate,
  };
}
