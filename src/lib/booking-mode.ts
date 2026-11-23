/**
 * Booking mode: while the vendor list is being populated the site runs in
 * WhatsApp mode. No pro listings are shown (so seed/demo profiles never reach
 * customers or search engines) and every "find a pro" / "book" path leads to
 * the /book request form, which hands off to the team on WhatsApp. The team
 * then books it as a concierge booking with a Paystack link, so the money
 * still goes through Groomee.
 *
 * Toggle: Admin → Settings → "Book on WhatsApp mode" (Setting
 * WHATSAPP_BOOKING_MODE). Unset means ON, so a fresh database is safe.
 * BOOKING_MODE=app|whatsapp in the environment overrides the setting.
 */
import { db } from "@/lib/db";

export const BOOKING_MODE_KEY = "WHATSAPP_BOOKING_MODE";

let cache: { at: number; on: boolean } | null = null;
const TTL = 30_000;

export async function isWhatsAppMode(): Promise<boolean> {
  const env = process.env.BOOKING_MODE?.trim().toLowerCase();
  if (env === "app") return false;
  if (env === "whatsapp") return true;
  if (cache && Date.now() - cache.at < TTL) return cache.on;
  let on = true;
  try {
    const row = await db.setting.findUnique({ where: { key: BOOKING_MODE_KEY } });
    on = row?.value !== "false";
  } catch {
    // DB unreachable (e.g. at build): fail safe to WhatsApp mode.
  }
  cache = { at: Date.now(), on };
  return on;
}

export function invalidateBookingModeCache() {
  cache = null;
}

/** /book link that keeps whatever the customer had already chosen. */
export function bookHref(opts: { service?: string | null; city?: string | null; area?: string | null; asap?: boolean } = {}) {
  const p = new URLSearchParams();
  if (opts.service) p.set("service", opts.service);
  if (opts.city) p.set("city", opts.city);
  if (opts.area) p.set("area", opts.area);
  if (opts.asap) p.set("when", "asap");
  const q = p.toString();
  return q ? `/book?${q}` : "/book";
}
