import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappGreeting, whatsappUrl } from "@/lib/whatsapp-channel";
import { AREAS, serviceBySlug } from "@/lib/seo/content";
import { FIRST_TOUCH_COOKIE, LAST_TOUCH_COOKIE, decodeTouch } from "@/lib/attribution";

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp/i;

const param = (req: NextRequest, key: string) =>
  req.nextUrl.searchParams.get(key)?.toLowerCase().slice(0, 40) || null;

// GET /api/wa?src=footer&city=abuja&svc=knotless-braids&area=lekki-phase-1
// Log the tap (with what and where it was about), then hand off to wa.me
// with a prefilled message the team can act on straight away.
export async function GET(req: NextRequest) {
  const source = (req.nextUrl.searchParams.get("src") ?? "unknown").slice(0, 40);
  const citySlug = param(req, "city");
  const serviceSlug = param(req, "svc");
  const areaSlug = param(req, "area");

  const city = citySlug
    ? await db.city.findUnique({ where: { slug: citySlug }, select: { name: true } })
    : null;
  const service = serviceSlug ? serviceBySlug(serviceSlug) : undefined;
  const area = areaSlug ? AREAS.find((a) => a.slug === areaSlug) : undefined;

  const first = decodeTouch(req.cookies.get(FIRST_TOUCH_COOKIE)?.value);
  const last = decodeTouch(req.cookies.get(LAST_TOUCH_COOKIE)?.value);

  // Link-preview fetchers (incl. WhatsApp's own) would inflate counts.
  if (!BOT_UA.test(req.headers.get("user-agent") ?? "")) {
    try {
      await db.whatsAppClick.create({
        data: {
          source,
          city: city ? citySlug : null,
          service: service ? serviceSlug : null,
          area: area ? areaSlug : null,
          channel: last?.channel ?? first?.channel ?? null,
          firstChannel: first?.channel ?? null,
          landingPath: first?.landing || null,
          channelDetail: (last ?? first)?.detail || null,
        },
      });
    } catch (err) {
      console.error("[wa] click log failed", err);
    }
  }

  // Beauty professionals asking to join get their own opener so the team
  // can tell recruits from customers at a glance.
  const text = source === "become-a-pro"
    ? "Hi Groomee! I'm a beauty professional and I'd like to join."
    : whatsappGreeting(city?.name, {
    serviceName: service?.name,
    areaName: area?.name,
  });
  return NextResponse.redirect(whatsappUrl(text), 302);
}
