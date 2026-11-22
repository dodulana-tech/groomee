/**
 * "Time to rebook?" WhatsApp nudges: one per completed booking, sent when
 * that service is typically due again. Repeat customers are the cheapest
 * growth there is, and the team tracks the 60-day rebook rate.
 *
 * Runs from the 10-minute cron tick. Sends only 10:00–19:00 Lagos time, in
 * small batches, never to someone who opted out (STOP), never if they have
 * booked again since, and never twice for the same booking.
 */
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { sendMessage } from "@/lib/whatsapp";

const DAY = 24 * 60 * 60 * 1000;

/** Typical days until the same service is due again; null = don't nudge. */
const CYCLE_BY_SLUG: Record<string, number | null> = {
  "knotless-braids": 35,
  "box-braids": 35,
  "locs-styling": 30,
  "weave-installation": 42,
  "natural-hair-styling": 14,
  "gel-nails": 21,
  "acrylic-nails": 21,
  "nail-art": 21,
  "fade-shape-up": 14,
  "classic-haircut": 21,
  "beard-grooming": 14,
  "classic-lash-set": 21,
  "volume-lashes": 21,
  "lash-lift-tint": 49,
  "facial-treatment": 30,
  "glow-treatment": 30,
  // Event services: nobody rebooks a bridal face on a timer.
  "bridal-makeup": null,
  "full-glam-makeup": null,
  "natural-makeup": null,
};
const CYCLE_BY_CATEGORY: Record<string, number | null> = {
  HAIR: 35, NAILS: 21, LASHES: 21, BARBING: 14, SKINCARE: 30, MAKEUP: null, OTHER: null,
};

export function cycleDays(slug: string, category: string): number | null {
  return slug in CYCLE_BY_SLUG ? CYCLE_BY_SLUG[slug] : CYCLE_BY_CATEGORY[category] ?? null;
}

const lagosHour = (d: Date) => (d.getUTCHours() + 1) % 24;

export function rebookMessage(o: { name: string | null; service: string; proName: string | null; weeks: number; link: string }) {
  const hi = o.name?.trim().split(/\s+/)[0] ? `Hi ${o.name.trim().split(/\s+/)[0]}!` : "Hi!";
  const pro = o.proName ? ` with ${o.proName}` : "";
  return (
    `${hi} It's been about ${o.weeks} weeks since your ${o.service.toLowerCase()}${pro}. 💚\n\n` +
    `Ready for your next one? Book in a minute: ${o.link}\n\n` +
    `Reply STOP if you'd rather not get reminders.`
  );
}

export async function runRebookReminders(now = new Date(), opts: { batch?: number; ignoreHours?: boolean } = {}) {
  const hour = lagosHour(now);
  if (!opts.ignoreHours && (hour < 10 || hour >= 19)) return { sent: 0, skipped: "outside 10:00-19:00 Lagos" };

  // Longest cycle is 49 days; look back a little further for late sends.
  const candidates = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      rebookReminderSentAt: null,
      confirmedAt: { gte: new Date(now.getTime() - 70 * DAY), lte: new Date(now.getTime() - 14 * DAY) },
      customer: { marketingOptOut: false, phone: { not: null } },
    },
    orderBy: { confirmedAt: "asc" },
    take: 200,
    select: {
      id: true,
      customerId: true,
      confirmedAt: true,
      service: { select: { slug: true, name: true, category: true } },
      pro: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
    },
  });

  let sent = 0;
  const batch = opts.batch ?? 15;
  for (const b of candidates) {
    if (sent >= batch) break;
    const cycle = cycleDays(b.service.slug, b.service.category);
    if (!cycle || !b.confirmedAt) {
      await db.booking.update({ where: { id: b.id }, data: { rebookReminderSentAt: now } }); // mark as handled
      continue;
    }
    const due = b.confirmedAt.getTime() + cycle * DAY;
    if (now.getTime() < due) continue;

    // Booked again since? Then they don't need a nudge.
    const again = await db.booking.findFirst({
      where: { customerId: b.customerId, id: { not: b.id }, createdAt: { gt: b.confirmedAt }, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    // Claim before sending so overlapping cron runs can't double-send.
    const claimed = await db.booking.updateMany({
      where: { id: b.id, rebookReminderSentAt: null },
      data: { rebookReminderSentAt: now },
    });
    if (claimed.count === 0 || again) continue;

    const link = `${SITE_URL}/api/wa?src=rebook&svc=${encodeURIComponent(b.service.slug)}`;
    try {
      await sendMessage(
        b.customer.phone!,
        rebookMessage({
          name: b.customer.name,
          service: b.service.name,
          proName: b.pro?.name ?? null,
          weeks: Math.round(cycle / 7),
          link,
        }),
      );
      sent++;
    } catch (err) {
      console.error("[rebook] send failed", b.id, err);
    }
  }
  return { sent, considered: candidates.length };
}
