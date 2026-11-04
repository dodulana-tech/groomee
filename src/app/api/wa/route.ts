import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappGreeting, whatsappUrl } from "@/lib/whatsapp-channel";

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp/i;

// GET /api/wa?src=footer&city=abuja — log the tap, then hand off to wa.me.
export async function GET(req: NextRequest) {
  const source = (req.nextUrl.searchParams.get("src") ?? "unknown").slice(0, 40);
  const citySlug = req.nextUrl.searchParams.get("city")?.toLowerCase().slice(0, 40) || null;

  const city = citySlug
    ? await db.city.findUnique({ where: { slug: citySlug }, select: { name: true } })
    : null;

  // Link-preview fetchers (incl. WhatsApp's own) would inflate counts.
  if (!BOT_UA.test(req.headers.get("user-agent") ?? "")) {
    try {
      await db.whatsAppClick.create({ data: { source, city: city ? citySlug : null } });
    } catch (err) {
      console.error("[wa] click log failed", err);
    }
  }

  return NextResponse.redirect(whatsappUrl(whatsappGreeting(city?.name)), 302);
}
