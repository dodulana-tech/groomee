/**
 * Groomee's public WhatsApp line (the number advertised on Instagram) and
 * helpers for routing customers to it. Distinct from TWILIO_WHATSAPP_NUMBER,
 * which is the transactional sender.
 *
 * Cities in WHATSAPP_CHANNEL_CITIES get WhatsApp-concierge CTAs even while
 * their City.status is WAITLIST — the team books them by hand over chat.
 */
export const GROOMEE_WHATSAPP =
  (process.env.NEXT_PUBLIC_GROOMEE_WHATSAPP ?? "2348084296023").replace(/\D/g, "");

export const WHATSAPP_CHANNEL_CITIES = ["abuja"];

export function isWhatsAppChannelCity(slug?: string | null): boolean {
  return !!slug && WHATSAPP_CHANNEL_CITIES.includes(slug.toLowerCase());
}

export function whatsappGreeting(
  cityName?: string | null,
  opts: { serviceName?: string | null; areaName?: string | null } = {},
): string {
  const what = opts.serviceName ? opts.serviceName.toLowerCase() : "a beauty pro";
  const where = [opts.areaName, cityName].filter(Boolean).join(", ");
  return where
    ? `Hi Groomee! I'd like to book ${what} at home in ${where}.`
    : `Hi Groomee! I'd like to book ${what}.`;
}

/** Direct wa.me link with a prefilled message. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/${GROOMEE_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * Tracked link — logs a WhatsAppClick then redirects to wa.me. Use this for
 * every on-site CTA so the weekly report can attribute demand.
 */
export function trackedWhatsAppHref(
  source: string,
  citySlug?: string | null,
  opts: { service?: string | null; area?: string | null } = {},
): string {
  const params = new URLSearchParams({ src: source });
  if (citySlug) params.set("city", citySlug);
  if (opts.service) params.set("svc", opts.service);
  if (opts.area) params.set("area", opts.area);
  return `/api/wa?${params.toString()}`;
}
