/**
 * Client-safe link rules for assistant replies. Model output is untrusted:
 * only links that pass these checks render as buttons; anything else shows
 * as plain text.
 */

export function isSafeCustomerLink(href: string): boolean {
  if (href.startsWith("/api/wa?")) return true;
  if (/^https:\/\/wa\.me\/\d+/.test(href)) return true;
  return /^\/(search|pro\/|profile\/health|bookings|gift|subscriptions|abuja|#waitlist-)/.test(href);
}

export function isSafeAdminLink(href: string): boolean {
  return /^\/admin(\/|$)/.test(href);
}

export function classifyClick(href: string): "booking" | "whatsapp" | null {
  if (href.startsWith("/api/wa") || href.includes("wa.me")) return "whatsapp";
  if (href.startsWith("/pro/") || href.startsWith("/search")) return "booking";
  return null;
}
