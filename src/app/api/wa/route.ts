import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappGreeting, whatsappUrl } from "@/lib/whatsapp-channel";
import { AREAS, serviceBySlug } from "@/lib/seo/content";
import { FIRST_TOUCH_COOKIE, LAST_TOUCH_COOKIE, decodeTouch } from "@/lib/attribution";

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp/i;

const param = (req: NextRequest, key: string) =>
  req.nextUrl.searchParams.get(key)?.toLowerCase().slice(0, 40) || null;

/** Free text from the /book form: one line, trimmed, capped. */
const text = (req: NextRequest, key: string, max: number) =>
  req.nextUrl.searchParams.get(key)?.replace(/\s+/g, " ").trim().slice(0, max) || null;

const TIME_LABEL: Record<string, string> = {
  morning: "morning (8am to 12pm)",
  afternoon: "afternoon (12pm to 4pm)",
  evening: "evening (4pm to 8pm)",
};

/** "when" from the form: asap | today | tomorrow | YYYY-MM-DD. */
function whenLabel(when: string | null, time: string | null): string | null {
  if (!when) return null;
  let day: string | null = null;
  if (when === "asap") return "As soon as possible";
  if (when === "today") day = "Today";
  else if (when === "tomorrow") day = "Tomorrow";
  else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const d = new Date(`${when}T12:00:00+01:00`);
    if (!isNaN(d.getTime())) {
      day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
    }
  }
  if (!day) return null;
  const t = time ? TIME_LABEL[time] : null;
  return t ? `${day}, ${t}` : day;
}

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

  // Extra detail from the /book request form.
  const when = whenLabel(param(req, "when"), param(req, "time"));
  const peopleN = Number(req.nextUrl.searchParams.get("n"));
  const people = Number.isInteger(peopleN) && peopleN > 1 && peopleN <= 20 ? peopleN : null;
  const place = area ? null : text(req, "place", 60);
  const note = text(req, "note", 280);
  const detailLines = [
    when && `When: ${when}`,
    people && `People: ${people}`,
    note && `Note: ${note}`,
  ].filter(Boolean) as string[];

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
          details: [place && `Area: ${place}`, ...detailLines].filter(Boolean).join(" · ") || null,
        },
      });
    } catch (err) {
      console.error("[wa] click log failed", err);
    }
  }

  // Beauty professionals asking to join get their own opener so the team
  // can tell recruits from customers at a glance.
  const message = source === "become-a-pro"
    ? "Hi Groomee! I'm a beauty professional and I'd like to join."
    : [
        whatsappGreeting(city?.name, { serviceName: service?.name, areaName: area?.name ?? place }),
        ...detailLines,
      ].join("\n");
  return NextResponse.redirect(whatsappUrl(message), 302);
}
