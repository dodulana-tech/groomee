/**
 * WhatsApp concierge bookings: the ops team turns a WhatsApp chat into a
 * paid, platform-run booking from /admin/bookings/new.
 *
 * Pricing comes from lib/booking-pricing (same numbers as the customer
 * flow), the pay link from lib/booking-payment (same Paystack init), and
 * after payment the booking runs through the same confirm → dispatch path.
 * The only things that differ: ops creates it on the customer's behalf,
 * the city gate also admits WHATSAPP_CHANNEL_CITIES, and the price can be
 * set within the catalogue band with a reason.
 */
import { db } from "@/lib/db";
import { z } from "zod";
import { formatPhone } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import { watLabel } from "@/lib/wat";

/** Normalised +234XXXXXXXXXX, or null if it isn't a Nigerian mobile. */
export function normaliseNigerianPhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s\-()]/g, "");
  const f = formatPhone(trimmed.startsWith("+") ? trimmed.slice(1) : trimmed);
  // formatPhone leaves unrecognised input as-is; also accept 10-digit "8031234567".
  const digits = f.replace(/\D/g, "");
  if (/^234[789]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^[789]\d{9}$/.test(digits)) return `+234${digits}`;
  return null;
}

/**
 * Find the customer by phone, or create them. Never changes an existing
 * user's role (an ADMIN or PRO stays what they are); fills in a missing name.
 */
export async function findOrCreateCustomerByPhone(phone: string, name?: string | null) {
  const cleanName = name?.trim() || null;
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    if (!existing.name && cleanName) {
      return {
        user: await db.user.update({ where: { id: existing.id }, data: { name: cleanName } }),
        created: false,
      };
    }
    return { user: existing, created: false };
  }
  try {
    const user = await db.user.create({
      data: { phone, name: cleanName, role: "CUSTOMER" },
    });
    return { user, created: true };
  } catch {
    // Unique race with a concurrent OTP sign-up: read the winner.
    const user = await db.user.findUniqueOrThrow({ where: { phone } });
    return { user, created: false };
  }
}

/** wa.me deep link that opens the ops person's WhatsApp on this customer's chat. */
export function waMeLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export interface PayMessageInput {
  customerName: string | null;
  reference: string;
  bookingId: string;
  serviceNames: string[];
  area: string | null;
  isAsap: boolean;
  scheduledFor: Date | null;
  totalAmount: number;
  payUrl: string;
}

/** Friendly message with the booking summary, total and pay link. */
export function buildPayMessage(b: PayMessageInput): string {
  const first = b.customerName?.trim().split(/\s+/)[0];
  const when = b.isAsap || !b.scheduledFor ? "As soon as possible" : watLabel(b.scheduledFor);
  const lines = [
    `Hi${first ? ` ${first}` : ""}! Here's your Groomee booking:`,
    "",
    `${b.serviceNames.join(" + ")}`,
    `${b.area ? `${b.area} · ` : ""}${when}`,
    `Total: ${formatNaira(b.totalAmount)}`,
    `Ref: ${b.reference}`,
    "",
    `Pay securely here to confirm your slot:`,
    b.payUrl,
    "",
    `Once you've paid we'll confirm your beauty pro and send their details. Track your booking any time: ${SITE_URL}/booking/${b.bookingId}`,
  ];
  return lines.join("\n");
}

/** Load what buildPayMessage needs for an existing booking. */
export async function payMessageForBooking(bookingId: string, payUrl: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      items: { include: { service: { select: { name: true } } }, orderBy: { sortOrder: "asc" } },
      zone: { select: { name: true, cityRel: { select: { name: true } } } },
    },
  });
  const area = b.zone
    ? [b.zone.name, b.zone.cityRel?.name].filter(Boolean).join(", ")
    : null;
  const text = buildPayMessage({
    customerName: b.customer.name,
    reference: b.reference,
    bookingId: b.id,
    serviceNames: [b.service.name, ...b.items.map((i) => i.service.name)],
    area,
    isAsap: b.isAsap,
    scheduledFor: b.scheduledFor,
    totalAmount: b.totalAmount,
    payUrl,
  });
  return { text, phone: b.customer.phone, booking: b };
}

/** Last-7-days concierge funnel, using the same revenue fields as the weekly report. */
export async function conciergeStats(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const created = await db.booking.findMany({
    where: { source: "WHATSAPP_CONCIERGE", createdAt: { gte: since } },
    select: {
      totalAmount: true,
      proEarning: true,
      status: true,
      payment: { select: { status: true } },
    },
  });
  const paid = created.filter(
    (b) =>
      b.payment &&
      ["AUTHORISED", "CAPTURED", "REFUNDED"].includes(b.payment.status),
  );
  const paidLive = paid.filter((b) => b.status !== "CANCELLED");
  return {
    since,
    created: created.length,
    paid: paid.length,
    awaitingPayment: created.filter((b) => b.status === "PENDING_PAYMENT").length,
    // GMV = totalAmount; Groomee revenue ("take") = totalAmount − proEarning,
    // the same definitions lib/admin-report.ts uses.
    gmv: paidLive.reduce((s, b) => s + b.totalAmount, 0),
    revenue: paidLive.reduce((s, b) => s + (b.totalAmount - b.proEarning), 0),
  };
}


// ─── Request shape shared by /quote and /bookings ───────────────────────────

export const conciergeInputSchema = z.object({
  phone: z.string().min(7, "Enter the customer's phone number."),
  name: z.string().max(80).optional(),
  zoneId: z.string().min(1, "Pick an area."),
  address: z.string().trim().min(5, "Add the address or a landmark."),
  isAsap: z.boolean(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  serviceIds: z.array(z.string().min(1)).min(1, "Pick at least one service.").max(9),
  proId: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
  priceOverride: z.number().positive().optional().nullable(),
  overrideReason: z.string().max(200).optional(),
  // Book a pre-assigned pro even when the scheduler says out of hours / clash
  // (ops has agreed the slot with the pro on WhatsApp).
  force: z.boolean().optional(),
});
export type ConciergeInput = z.infer<typeof conciergeInputSchema>;
